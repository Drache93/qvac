// Regenerate maintained first-party runtime snapshots from reviewed workspace
// builds and integrity-verified published archives. No installed bytes are trusted.
// Usage: node scripts/sync-qvac-vendors.mjs /path/to/qvac/packages [--only core,harness]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packages = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)))
const cli = fileURLToPath(new URL('..', import.meta.url))
const targetRoot = path.join(cli, 'vendor/qvac')
const names = ['sdk', 'inference', 'core', 'harness']
const onlyIndex = process.argv.indexOf('--only')
const selected = onlyIndex === -1 ? names : process.argv[onlyIndex + 1].split(',')
if (selected.some((name) => !names.includes(name))) throw new Error('Unknown snapshot selection')
const origins = JSON.parse(fs.readFileSync(new URL('./vendor/qvac-origins.json', import.meta.url)))
const cliManifest = JSON.parse(fs.readFileSync(path.join(cli, 'package.json')))
const nativePeers =
  JSON.parse(fs.readFileSync(path.join(packages, 'inference/package.json'))).peerDependencies || {}
const hostProviders = new Set([
  ...Object.keys(nativePeers),
  'bare-ffmpeg',
  'bare-pdfium',
  'bare-sidecar',
  'bare-runtime',
  'bare-media',
  'bare-link',
  'bare-crypto',
  'bare-https',
  'bare-tls',
  'bare-supervisor'
])
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-snapshots-'))

async function publishedSource(name) {
  const origin = origins[name]
  const cache = path.join(
    process.env.QVAC_VENDOR_CACHE || path.join(os.tmpdir(), 'qvac-vendor-cache'),
    origin.integrity.slice(7).replaceAll('/', '_').replaceAll('+', '-')
  )
  fs.mkdirSync(cache, { recursive: true })
  const archive = path.join(cache, 'package.tgz')
  const valid = () =>
    fs.existsSync(archive) &&
    crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64') ===
      origin.integrity.slice(7)
  if (!valid()) {
    const response = await fetch(origin.url)
    if (!response.ok) {
      throw new Error('Cannot fetch exact upstream ' + name + ': ' + response.status)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (crypto.createHash('sha512').update(bytes).digest('base64') !== origin.integrity.slice(7)) {
      throw new Error('Archive integrity mismatch: ' + name)
    }
    fs.writeFileSync(archive, bytes)
  }
  const extracted = path.join(temporary, name)
  fs.mkdirSync(extracted)
  execFileSync('tar', ['-xzf', archive, '-C', extracted])
  return path.join(extracted, 'package')
}

try {
  for (const name of ['inference', 'sdk'].filter((name) => selected.includes(name))) {
    execFileSync('npm', ['run', 'build'], { cwd: path.join(packages, name), stdio: 'inherit' })
  }
  for (const name of selected) {
    const workspace = name === 'sdk' || name === 'inference'
    const source = workspace ? path.join(packages, name) : await publishedSource(name)
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json')))
    if (
      manifest.name !== '@qvac/' + name ||
      (!workspace && manifest.version !== origins[name].version)
    ) {
      throw new Error('Unexpected source package: ' + name)
    }
    const packed = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          '--dry-run',
          '--ignore-scripts',
          '--json',
          '--cache',
          path.join(temporary, 'npm-cache')
        ],
        { cwd: source, encoding: 'utf8' }
      )
    )[0]
    const target = path.join(targetRoot, name)
    fs.rmSync(target, { recursive: true, force: true })
    fs.mkdirSync(target, { recursive: true })
    const files = {}
    const assets = {}
    for (const entry of packed.files) {
      const relative = entry.path
      if (
        relative === 'package.json' ||
        relative.startsWith('test/') ||
        (relative.startsWith('scripts/') &&
          !(
            name === 'harness' &&
            ['scripts/addon-externals.cjs', 'scripts/addon-externals.d.ts'].includes(relative)
          )) ||
        relative.endsWith('.map')
      ) {
        continue
      }
      if (
        name === 'sdk' &&
        (relative.startsWith('dist/examples/') || relative.startsWith('dist/scripts/'))
      ) {
        continue
      }
      if (path.isAbsolute(relative) || relative.split('/').includes('..')) {
        throw new Error('Invalid package path')
      }
      const from = path.join(source, relative)
      if (!fs.lstatSync(from).isFile()) {
        throw new Error('Expected a regular packaged file: ' + relative)
      }
      const to = path.join(target, relative)
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
      const hashes =
        relative.split('/').includes('prebuilds') || relative.startsWith('weights/')
          ? assets
          : files
      hashes[relative] = digest(fs.readFileSync(to))
    }
    delete manifest.devDependencies
    delete manifest.scripts
    delete manifest.publishConfig
    delete manifest.overrides
    delete manifest.patchedDependencies
    if (name === 'sdk') {
      // CLI SDK commands register their native TS importer; standalone SDK keeps
      // its original optional peer in its owning source package.
      delete manifest.peerDependencies?.tsx
      delete manifest.peerDependenciesMeta?.tsx
      for (const dependency of Object.keys(nativePeers)) {
        if (manifest.dependencies?.[dependency] && cliManifest.dependencies?.[dependency]) {
          manifest.dependencies[dependency] = cliManifest.dependencies[dependency]
        }
      }
    }
    for (const [dependency, version] of Object.entries({
      'bare-module': '7.1.0',
      'bare-http1': '4.5.9',
      'bare-path': '3.0.1',
      'bare-worker': '4.5.0',
      'bare-runtime': '1.34.0'
    })) {
      if (manifest.dependencies?.[dependency]) manifest.dependencies[dependency] = version
    }
    if (name === 'inference' || name === 'harness') {
      for (const dependency of Object.keys(manifest.peerDependencies || {})) {
        if (dependency.startsWith('@qvac/') && cliManifest.dependencies?.[dependency]) {
          const spec = cliManifest.dependencies[dependency]
          manifest.peerDependencies[dependency] = spec.startsWith('file:')
            ? JSON.parse(fs.readFileSync(path.join(cli, spec.slice(5), 'package.json'))).version
            : spec
        }
      }
    }
    if (name === 'harness') {
      Object.assign(manifest.peerDependencies, {
        '@qvac/llm-llamacpp': cliManifest.dependencies['@qvac/llm-llamacpp'],
        '@qvac/translation-nmtcpp': cliManifest.dependencies['@qvac/translation-nmtcpp']
      })
      for (const optional of [
        'pyodide',
        '@jitl/quickjs-singlefile-mjs-release-sync',
        'quickjs-emscripten-core'
      ]) {
        delete manifest.peerDependencies?.[optional]
        delete manifest.peerDependenciesMeta?.[optional]
      }
    }
    for (const other of names) {
      if (manifest.dependencies?.['@qvac/' + other]) {
        manifest.dependencies['@qvac/' + other] = JSON.parse(
          fs.readFileSync(path.join(targetRoot, other, 'package.json'))
        ).version
      }
    }
    if (name === 'core' || name === 'harness') {
      for (const [dependency, spec] of Object.entries(cliManifest.dependencies || {})) {
        if (manifest.dependencies?.[dependency] && spec.startsWith('file:vendor/')) {
          manifest.dependencies[dependency] = JSON.parse(
            fs.readFileSync(path.join(cli, spec.slice(5), 'package.json'))
          ).version
        }
      }
    }
    if (['sdk', 'core', 'harness'].includes(name)) {
      for (const dependency of hostProviders) {
        if (!manifest.dependencies?.[dependency]) continue
        manifest.peerDependencies ||= {}
        manifest.peerDependencies[dependency] =
          cliManifest.dependencies?.[dependency] || manifest.dependencies[dependency]
        delete manifest.dependencies[dependency]
        delete manifest.peerDependenciesMeta?.[dependency]
      }
    }
    manifest.files = [
      ...new Set(Object.keys({ ...files, ...assets }).map((file) => file.split('/')[0]))
    ]
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
    files['package.json'] = digest(fs.readFileSync(path.join(target, 'package.json')))
    let origin
    if (workspace) {
      const git = (args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim()
      const sourceFiles = {}
      function scan(directory, prefix = '') {
        for (const entry of fs
          .readdirSync(directory, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name))) {
          const relative = prefix + entry.name
          if (entry.isDirectory()) scan(path.join(directory, entry.name), relative + '/')
          else sourceFiles[relative] = digest(fs.readFileSync(path.join(directory, entry.name)))
        }
      }
      scan(path.join(source, 'src'), 'src/')
      sourceFiles['package.json'] = digest(fs.readFileSync(path.join(source, 'package.json')))
      origin = {
        kind: 'workspace',
        baseCommit: git(['rev-parse', 'HEAD']),
        sourceFilesAuthoritative: true,
        sourceSha256: digest(JSON.stringify(sourceFiles)),
        sourceFiles
      }
    } else origin = { kind: 'npm', ...origins[name] }
    fs.writeFileSync(
      path.join(target, 'PROVENANCE.json'),
      JSON.stringify(
        {
          format: 1,
          name: manifest.name,
          version: manifest.version,
          origin,
          changes: workspace
            ? 'Reviewed workspace build preserving original external dependency policy; native CLI TS loader bridge; native host peer versions aligned to the validated CLI distribution graph; maintained siblings use exact versions; required native host peers avoid recursive binary bundling.' +
              (name === 'sdk' ? ' Bare runtime is pinned to the validated CLI 1.34.0 binary.' : '')
            : 'Exact verified published runtime bytes; omit test/build payloads; CLI manifest pins validated native/runtime graph and maintained dependencies; optional language providers prepared separately; required native host peers supplied by the CLI avoid recursive binary bundling.',
          files,
          assets
        },
        null,
        2
      ) + '\n'
    )
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
