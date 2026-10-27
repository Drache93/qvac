// Materialize ignored native files from immutable published tarballs before build/pack.
// --check verifies all files without fetching or mutating anything.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../vendor/qvac/', import.meta.url))
const check = process.argv.includes('--check')
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const valid = (file, expected) =>
  fs.existsSync(file) && fs.lstatSync(file).isFile() && hash(file) === expected
for (const name of ['sdk', 'inference', 'core', 'harness']) {
  const directory = path.join(root, name)
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'PROVENANCE.json')))
  const expected = new Set([
    'PROVENANCE.json',
    ...Object.keys(provenance.files),
    ...Object.keys(provenance.assets)
  ])
  function checkEntries(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (entry.isDirectory() && entry.name === 'node_modules') {
        throw new Error(
          `vendor/qvac/${name}/${relative} was installed into the snapshot: ` +
            'npm links file: dependencies unless installed with npm ci --install-links'
        )
      }
      if (entry.isDirectory()) checkEntries(path.join(folder, entry.name), relative + '/')
      else if (!entry.isFile() || !expected.has(relative)) {
        throw new Error('Unexpected vendor runtime file: ' + name + '/' + relative)
      }
    }
  }
  checkEntries(directory)
  for (const [relative, expected] of Object.entries(provenance.files)) {
    if (!valid(path.join(directory, relative), expected)) {
      throw new Error('Changed vendor source: ' + name + '/' + relative)
    }
  }
  const missing = Object.entries(provenance.assets).filter(
    ([relative, expected]) => !valid(path.join(directory, relative), expected)
  )
  if (!missing.length) continue
  if (check) {
    throw new Error(
      'Missing or changed vendor native assets: ' +
        name +
        '. Run node scripts/prepare-qvac-vendors.mjs'
    )
  }
  const { url, integrity } = provenance.origin
  if (!url?.startsWith('https://registry.npmjs.org/') || !integrity?.startsWith('sha512-')) {
    throw new Error('Invalid published asset provenance')
  }
  const cache = path.join(
    process.env.QVAC_VENDOR_CACHE || path.join(os.tmpdir(), 'qvac-vendor-cache'),
    integrity.slice(7).replaceAll('/', '_').replaceAll('+', '-')
  )
  fs.mkdirSync(cache, { recursive: true })
  const archive = path.join(cache, 'package.tgz')
  const verify = () =>
    fs.existsSync(archive) &&
    crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64') ===
      integrity.slice(7)
  if (!verify()) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Unable to fetch pinned native package: ' + response.status)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (crypto.createHash('sha512').update(bytes).digest('base64') !== integrity.slice(7)) {
      throw new Error('Native tarball integrity mismatch')
    }
    fs.writeFileSync(archive, bytes)
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-native-assets-'))
  try {
    execFileSync('tar', ['-xzf', archive, '-C', temporary])
    for (const [relative, expected] of missing) {
      // a native file sits in a prebuilds/ or weights/ folder at any depth, as .gitignore leaves them out
      const segments = relative.split('/')
      if (
        path.isAbsolute(relative) ||
        segments.includes('..') ||
        !segments.slice(0, -1).some((segment) => segment === 'prebuilds' || segment === 'weights')
      ) {
        throw new Error('Invalid native asset path')
      }
      const source = path.join(temporary, 'package', relative)
      if (!valid(source, expected)) throw new Error('Published asset hash mismatch: ' + relative)
      const target = path.join(directory, relative)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(source, target)
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
