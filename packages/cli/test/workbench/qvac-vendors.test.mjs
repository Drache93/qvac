import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const root = fileURLToPath(new URL('../..', import.meta.url))
const names = ['sdk', 'inference', 'core', 'harness']
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')

test('runtime snapshots retain declared files and exclude removed runtime dependencies', () => {
  execFileSync(process.execPath, ['scripts/prepare-qvac-vendors.mjs', '--check'], { cwd: root })
  for (const name of names) {
    const directory = path.join(root, 'vendor/qvac', name)
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')))
    const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'PROVENANCE.json')))
    assert.equal(pkg.name, '@qvac/' + name)
    assert.equal(pkg.version, provenance.version)
    if (name === 'sdk' || name === 'inference') {
      assert.equal(pkg.dependencies['fast-safe-stringify'], '2.1.1')
      assert.match(pkg.dependencies.semver, /^\^7\./)
      assert.equal(pkg.dependencies.zod, '4.6.5')
    }
    assert.equal(pkg.dependencies?.brittle, undefined)
    assert.equal(pkg.scripts, undefined)
    assert.equal(pkg.patchedDependencies, undefined)
    for (const [dependency, version] of Object.entries({
      'bare-module': '7.1.0',
      'bare-http1': '4.5.9',
      'bare-path': '3.0.1',
      'bare-worker': '4.5.0',
      'bare-runtime': '1.34.0'
    })) {
      if (pkg.dependencies?.[dependency]) assert.equal(pkg.dependencies[dependency], version)
    }
    if (name === 'sdk') {
      assert.equal(pkg.peerDependencies?.tsx, undefined)
      assert.equal(pkg.peerDependencies['bare-runtime'], '1.34.0')
      assert.equal(pkg.dependencies['bare-runtime'], undefined)
      assert.equal(pkg.peerDependencies['@qvac/embed-llamacpp'], '0.52.1')
      assert.equal(pkg.peerDependenciesMeta?.['bare-runtime'], undefined)
    }
    if (name === 'harness') {
      assert.equal(pkg.dependencies['@qvac/inference'], '0.22.0')
      assert.equal(pkg.peerDependencies['@qvac/llm-llamacpp'], '0.64.3')
      assert.equal(pkg.peerDependencies['@qvac/translation-nmtcpp'], '10.0.0')
      assert.equal(pkg.peerDependencies.pyodide, undefined)
      assert.ok(provenance.files['patches/pyodide@314.0.2.patch'])
      for (const file of ['scripts/addon-externals.cjs', 'scripts/addon-externals.d.ts']) {
        assert.ok(provenance.files[file], `Exported Harness helper is tracked: ${file}`)
        assert.ok(fs.statSync(path.join(directory, file)).isFile())
      }
      const helper = createRequire(import.meta.url)(
        path.join(directory, 'scripts/addon-externals.cjs')
      )
      assert.equal(typeof helper.copyAddonExternals, 'function')
      assert.ok(helper.deferSpecifiers().includes('@qvac/llm-llamacpp'))
    }
    assert.ok(provenance.files['package.json'])
  }
})

test('verification rejects changed source and missing native data without fetching', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-vendor-verify-'))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  fs.mkdirSync(path.join(fixture, 'scripts'))
  fs.copyFileSync(
    path.join(root, 'scripts/prepare-qvac-vendors.mjs'),
    path.join(fixture, 'scripts/prepare-qvac-vendors.mjs')
  )
  fs.writeFileSync(
    path.join(fixture, 'deny.mjs'),
    'globalThis.fetch = () => { throw new Error("NETWORK CALLED") }'
  )
  for (const name of names) {
    const directory = path.join(fixture, 'vendor/qvac', name)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'index.js'), 'original')
    fs.writeFileSync(
      path.join(directory, 'PROVENANCE.json'),
      JSON.stringify({ files: { 'index.js': sha('original') }, assets: {} })
    )
  }
  const run = () =>
    execFileSync(
      process.execPath,
      ['--import', './deny.mjs', 'scripts/prepare-qvac-vendors.mjs', '--check'],
      { cwd: fixture, stdio: 'pipe' }
    )
  run()
  const directory = path.join(fixture, 'vendor/qvac/sdk')
  fs.writeFileSync(path.join(directory, 'injected.js'), 'unexpected runtime code')
  assert.throws(run, /Unexpected vendor runtime file: sdk\/injected.js/)
  fs.unlinkSync(path.join(directory, 'injected.js'))
  fs.writeFileSync(path.join(directory, 'index.js'), 'changed')
  assert.throws(run, /Changed vendor source/)
  fs.writeFileSync(path.join(directory, 'index.js'), 'original')
  fs.writeFileSync(
    path.join(directory, 'PROVENANCE.json'),
    JSON.stringify({
      files: { 'index.js': sha('original') },
      assets: { 'prebuilds/example.bare': sha('native') }
    })
  )
  assert.throws(run, /Missing or changed vendor native assets/)
})
