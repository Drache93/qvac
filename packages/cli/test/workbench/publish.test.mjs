import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-publish-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  for (const name of ['package.json', 'npm-shrinkwrap.json', 'scripts', 'vendor']) {
    fs.cpSync(path.join(root, name), path.join(dir, name), {
      recursive: true,
      mode: fs.constants.COPYFILE_FICLONE,
      filter: (file) => !file.split(path.sep).includes('node_modules')
    })
  }
  return dir
}

function check(dir, args = []) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts/check-publish-ready.cjs'), ...args], {
    encoding: 'utf8'
  })
}

test('publish check accepts the committed manifest and distribution lock', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/check-publish-ready.cjs')])
})

test('publish check rejects a stale npm dependency lock', (t) => {
  const dir = fixture(t)
  const file = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  pkg.dependencies['bare-runtime'] = '1.35.0'
  fs.writeFileSync(file, JSON.stringify(pkg))
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /npm-shrinkwrap\.json dependencies\["bare-runtime"\] differs/)
})

test('publish check requires a distribution lock', (t) => {
  const dir = fixture(t)
  fs.unlinkSync(path.join(dir, 'npm-shrinkwrap.json'))
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /npm-shrinkwrap\.json is missing/)
})

test('publish check allows CI package-name normalization', (t) => {
  const dir = fixture(t)
  const file = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  pkg.name = '@tetherto/cli-mono'
  fs.writeFileSync(file, JSON.stringify(pkg))
  assert.equal(check(dir).status, 0)
})

test('npm archive includes the distribution lock', (t) => {
  const dir = fixture(t)
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-pack-cache-'))
  t.after(() => fs.rmSync(cache, { recursive: true, force: true }))
  const output = execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--ignore-scripts', '--json', '--cache', cache],
    { cwd: dir, encoding: 'utf8' }
  )
  const [archive] = JSON.parse(output)
  assert.ok(archive.files.some((file) => file.path === 'npm-shrinkwrap.json'))
})

test('publish check rejects arbitrary local SDK dependencies', (t) => {
  const dir = fixture(t),
    file = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  pkg.dependencies['@qvac/sdk'] = 'file:../sdk'
  fs.writeFileSync(file, JSON.stringify(pkg))
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /unverified local path/)
})

test('publish check rejects unbundled local runtime snapshots', (t) => {
  const dir = fixture(t),
    file = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  pkg.bundledDependencies = pkg.bundledDependencies.filter((name) => name !== 'zod')
  fs.writeFileSync(file, JSON.stringify(pkg))
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /zod local snapshot is not listed in bundledDependencies/)
})

test('publish check rejects changed runtime snapshot code', (t) => {
  const dir = fixture(t)
  fs.appendFileSync(path.join(dir, 'vendor/zod/index.js'), '\n// changed\n')
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /zod snapshot hash mismatch|Zod snapshot changed/)
})

test('publish check rejects workspace links in the bundled dependency tree', (t) => {
  const dir = fixture(t)
  fs.mkdirSync(path.join(dir, 'node_modules/@qvac'), { recursive: true })
  fs.symlinkSync(path.join(dir, 'vendor/qvac/sdk'), path.join(dir, 'node_modules/@qvac/sdk'), 'dir')
  const result = check(dir, ['--installed'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /@qvac\/sdk must be installed as a bundled snapshot/)
})

test('bundled snapshot dependencies remain portable in consumer locks', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  for (const [name, spec] of Object.entries(pkg.dependencies)) {
    if (!spec.startsWith('file:vendor/')) continue
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, spec.slice(5), 'package.json'), 'utf8')
    )
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, range] of Object.entries(manifest[field] || {})) {
        // npm install accepts bundled siblings with relative file refs, but
        // default npm ci cannot reconstruct those edges from its consumer lock.
        assert.doesNotMatch(range, /^(file:|link:)/, `${name} ${field}.${dependency}`)
      }
    }
  }
})

test('publish check rejects exported helpers omitted from snapshot and inventory', (t) => {
  const dir = fixture(t)
  const snapshot = path.join(dir, 'vendor/qvac/harness')
  const relative = 'scripts/addon-externals.cjs'
  fs.unlinkSync(path.join(snapshot, relative))
  const file = path.join(snapshot, 'PROVENANCE.json')
  const provenance = JSON.parse(fs.readFileSync(file, 'utf8'))
  delete provenance.files[relative]
  fs.writeFileSync(file, JSON.stringify(provenance))
  const result = check(dir)
  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /@qvac\/harness snapshot export is missing or invalid: \.\/scripts\/addon-externals\.cjs/
  )
})
