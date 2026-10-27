import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const specs = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/vendor/third-party.json'), 'utf8')
)
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding)
function files(directory, relative = '') {
  return fs
    .readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.posix.join(relative, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${name}`)
      return entry.isDirectory() ? files(directory, name) : [name]
    })
    .sort()
}
function keep(spec, name) {
  if (/\.map$/.test(name)) return false
  if (/^readme(?:\.[^/]+)?$/i.test(name)) return true
  if (/^(?:test|tests|bench|benchmark)(?:\.[cm]?js|\/)/.test(name)) return false
  if (/(^|\/)(license|licence|copying|notice)([.\/-]|$)/i.test(name)) return true
  if (
    /^(test|tests|test-integration|tests-integration|playground|bin|benchmark|benchmarks)\//.test(
      name
    )
  ) {
    return false
  }
  if (name === 'package.json') return false
  if (spec.name === 'tinyld') return name.startsWith('dist/')
  return /\.(?:[cm]?js|[cm]?ts|json)$/.test(name) || name === 'range.bnf'
}
// npm normalizes directory modes; raw tar extraction does not (tinyld ships 0644 directories).
function normalizeDirectories(directory) {
  fs.chmodSync(directory, 0o755)
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) normalizeDirectories(path.join(directory, entry.name))
  }
}
function write(spec, source, target) {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  if (manifest.name !== spec.name || manifest.version !== spec.version) {
    throw new Error(`Wrong source: ${spec.name}`)
  }
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5 })
  fs.mkdirSync(target, { recursive: true })
  for (const name of files(source).filter((name) => keep(spec, name))) {
    const output = path.join(target, name)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.copyFileSync(path.join(source, name), output)
  }
  for (const patch of spec.patches ?? []) {
    const output = path.join(target, patch.file)
    const source = fs.readFileSync(output, 'utf8')
    if (source.split(patch.from).length !== 2) {
      throw new Error(`Patch no longer matches once: ${spec.name}/${patch.file}`)
    }
    fs.writeFileSync(output, source.replace(patch.from, patch.to))
  }
  if (spec.name === 'unpdf') {
    fs.copyFileSync(
      path.join(root, 'scripts/vendor/pdfjs-license.txt'),
      path.join(target, 'LICENSE-PDFJS')
    )
  }
  for (const key of [
    'scripts',
    'devDependencies',
    'bin',
    'packageManager',
    'lint-staged',
    'funding',
    'publishConfig'
  ]) {
    delete manifest[key]
  }
  manifest.files = ['**/*']
  manifest['x-qvac-fork'] = {
    upstream: spec.repository,
    version: spec.version,
    integrity: spec.integrity,
    changes: [
      'Library-only distribution; runtime changes, if any, are recorded as exact patches in PROVENANCE.json.',
      'Bundled local snapshot; no remote fork or registry publication required.'
    ]
  }
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(
    path.join(target, 'QVAC-NOTICE.md'),
    `# ${spec.name} runtime snapshot\n\nQVAC maintains this local snapshot of ${spec.name} ${spec.version}. Based on the integrity-pinned upstream npm distribution. Any runtime changes are recorded as exact patches in PROVENANCE.json; all other runtime bytes are unchanged. Original authorship and license notices are retained. CLI binaries, development metadata, tests and source maps are excluded.\n\nThe module name and version are retained for compatibility with existing consumers. No upstream repository ownership, new remote repository or npm publication is implied. Update this snapshot through scripts/sync-third-party.mjs and run the runtime contract and installed CLI suites.\n`
  )
  const sha256 = Object.fromEntries(
    files(target).map((name) => [name, hash(fs.readFileSync(path.join(target, name)))])
  )
  fs.writeFileSync(
    path.join(target, 'PROVENANCE.json'),
    JSON.stringify({ ...spec, sha256 }, null, 2) + '\n'
  )
}
function check(spec, target) {
  const provenance = JSON.parse(fs.readFileSync(path.join(target, 'PROVENANCE.json'), 'utf8'))
  for (const key of ['name', 'version', 'integrity']) {
    if (provenance[key] !== spec[key]) throw new Error(`Wrong provenance: ${spec.name}`)
  }
  const actual = files(target).filter((name) => name !== 'PROVENANCE.json')
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(provenance.sha256).sort())) {
    throw new Error(`Snapshot file list changed: ${spec.name}`)
  }
  for (const name of actual) {
    if (hash(fs.readFileSync(path.join(target, name))) !== provenance.sha256[name]) {
      throw new Error(`Snapshot changed: ${spec.name}/${name}`)
    }
  }
}
const mode = process.argv[2]
if (mode !== '--check' && mode !== '--refresh') {
  throw new Error('Usage: node scripts/sync-third-party.mjs --check | --refresh')
}
for (const spec of specs) {
  const target = path.join(root, 'vendor', spec.directory)
  if (mode === '--check') {
    check(spec, target)
    continue
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-vendor-'))
  try {
    const packed = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          `${spec.name}@${spec.version}`,
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          staging
        ],
        { cwd: staging, encoding: 'utf8' }
      )
    )[0]
    const archive = path.join(staging, packed.filename)
    const integrity = `sha512-${hash(fs.readFileSync(archive), 'sha512', 'base64')}`
    if (integrity !== spec.integrity) throw new Error(`Upstream integrity mismatch: ${spec.name}`)
    execFileSync('tar', ['-xzf', archive, '-C', staging])
    normalizeDirectories(staging)
    write(spec, path.join(staging, 'package'), target)
    check(spec, target)
  } finally {
    normalizeDirectories(staging)
    fs.rmSync(staging, { recursive: true, force: true, maxRetries: 5 })
  }
}
