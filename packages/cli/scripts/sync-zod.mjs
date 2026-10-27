import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'vendor/zod')
const pinned = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/vendor/zod-upstream.json'), 'utf8')
)
const upstream = {
  upstream: 'https://github.com/colinhacks/zod',
  tag: 'v4.6.5',
  commit: '59bbc03e10c636b9eb3c393dfeb552819774ec21',
  integrity: pinned.integrity,
  changes: [
    'Library-only runtime distribution; original zod specifier and version retained for SDK/Core/Harness compatibility.',
    'No parser, validator or schema behavior changes.'
  ]
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
function files(directory, relative = '', sourceOnly = false) {
  return fs
    .readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.posix.join(relative, entry.name)
      if (
        sourceOnly &&
        (entry.name === 'node_modules' || entry.name === 'src' || entry.name === '.git')
      ) {
        return []
      }
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${name}`)
      return entry.isDirectory() ? files(directory, name, sourceOnly) : [name]
    })
    .sort()
}
function selectedFiles(directory) {
  return files(directory, '', true).filter(
    (name) =>
      name !== 'package.json' &&
      name !== 'PROVENANCE.json' &&
      (name === 'LICENSE' || /\.(?:[cm]?js|d\.[cm]?ts|json)$/.test(name))
  )
}
function verifyUpstream(directory) {
  const selected = selectedFiles(directory)
  if (JSON.stringify(selected) !== JSON.stringify(Object.keys(pinned.sha256).sort())) {
    throw new Error('Zod runtime file list differs from the integrity-pinned upstream archive')
  }
  for (const name of selected) {
    if (hash(fs.readFileSync(path.join(directory, name))) !== pinned.sha256[name]) {
      throw new Error(`Zod runtime differs from the integrity-pinned upstream archive: ${name}`)
    }
  }
  return selected
}
function exportsWithoutSource(value) {
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '@zod/source')
      .map(([key, item]) => [key, exportsWithoutSource(item)])
  )
}

if (process.argv[2] === '--check') {
  verifyUpstream(target)
  const provenance = JSON.parse(fs.readFileSync(path.join(target, 'PROVENANCE.json'), 'utf8'))
  const actual = files(target).filter((name) => name !== 'PROVENANCE.json')
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(provenance.sha256).sort())) {
    throw new Error('Zod snapshot file list differs from provenance')
  }
  for (const name of actual) {
    if (hash(fs.readFileSync(path.join(target, name))) !== provenance.sha256[name]) {
      throw new Error(`Zod snapshot changed: ${name}`)
    }
  }
} else {
  if (!process.argv[2]) {
    throw new Error('Usage: node scripts/sync-zod.mjs <built-zod-package> | --check')
  }
  const source = path.resolve(process.argv[2])
  if (source === target || source.startsWith(target + path.sep)) {
    throw new Error('Source must be outside the generated snapshot')
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  if (manifest.name !== pinned.name || manifest.version !== pinned.version) {
    throw new Error(
      'Expected a built Zod 4.6.5 package; update the reviewed upstream pin before changing versions'
    )
  }
  for (const required of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts', 'LICENSE']) {
    if (!fs.existsSync(path.join(source, required))) {
      throw new Error(`Missing built artifact: ${required}`)
    }
  }
  const names = verifyUpstream(source)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  for (const name of names) {
    const output = path.join(target, name)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.copyFileSync(path.join(source, name), output)
  }
  for (const key of ['scripts', 'zshy', 'funding', 'support', 'llms', 'llmsFull', 'mcpServer']) {
    delete manifest[key]
  }
  manifest.exports = exportsWithoutSource(manifest.exports)
  manifest.files = [
    '**/*.js',
    '**/*.cjs',
    '**/*.d.ts',
    '**/*.d.cts',
    '**/package.json',
    'LICENSE',
    'NOTICE.md',
    'PROVENANCE.json'
  ]
  manifest.sideEffects = ['./compile.js', './compile.cjs']
  manifest.repository = { type: 'git', url: 'https://github.com/tetherto/zod.git' }
  manifest.homepage = 'https://github.com/tetherto/zod'
  manifest.bugs = { url: 'https://github.com/tetherto/zod/issues' }
  manifest['x-qvac-fork'] = upstream
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(
    path.join(target, 'NOTICE.md'),
    '# Zod runtime fork\n\nThis is the Tether-maintained runtime snapshot of Zod 4.6.5, based on upstream commit `59bbc03e10c636b9eb3c393dfeb552819774ec21`. The original MIT license and author attribution are preserved. Runtime JavaScript and declarations are unchanged; distribution metadata excludes upstream development tools and source-only export conditions.\n\nThe `zod` module specifier and version are retained so CLI, SDK, Core and Harness share a compatible runtime. This snapshot is bundled with the CLI and does not require publication of a new npm package. The source fork is intended for `tetherto/zod`; no remote repository or npm release is created by this change.\n'
  )
  const sha256 = Object.fromEntries(
    files(target).map((name) => [name, hash(fs.readFileSync(path.join(target, name)))])
  )
  fs.writeFileSync(
    path.join(target, 'PROVENANCE.json'),
    JSON.stringify({ upstream, sha256 }, null, 2) + '\n'
  )
}
