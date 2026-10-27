#!/usr/bin/env node
// Gate for `npm publish` (wired via `prepublishOnly` in package.json).
//
// Published CLI installs need the generated npm shrinkwrap: npm ignores an
// installed dependency's overrides. Keep its direct specs aligned with the
// manifest; npm version handles release-version metadata separately.

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const PKG_PATH = path.resolve(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))

const errors = []
const root = path.dirname(PKG_PATH)
const snapshots = new Map()
for (const [name, spec] of Object.entries(pkg.dependencies || {})) {
  if (/^(file:|link:)/.test(spec)) {
    try {
      const snapshot = verifySnapshot(name, spec)
      snapshots.set(name, snapshot)
      if (process.argv.includes('--installed')) verifyInstalledSnapshot(name, snapshot)
    } catch (error) {
      errors.push(error.message)
    }
  }
}
for (const script of ['sync-zod.mjs', 'sync-third-party.mjs', 'prepare-qvac-vendors.mjs']) {
  const file = path.join(root, 'scripts', script)
  if (!fs.existsSync(file)) continue
  try {
    execFileSync(process.execPath, [file, '--check'], { cwd: root, stdio: 'pipe' })
  } catch (error) {
    errors.push(`${script} integrity check failed: ${String(error.stderr || error.message).trim()}`)
  }
}

const lockPath = path.resolve(__dirname, '..', 'npm-shrinkwrap.json')
if (!fs.existsSync(lockPath)) {
  errors.push('npm-shrinkwrap.json is missing; regenerate the npm distribution lock')
} else {
  const locked = JSON.parse(fs.readFileSync(lockPath, 'utf8')).packages?.['']
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const wanted = pkg[field] || {}
    const actual = locked?.[field] || {}
    for (const name of new Set([...Object.keys(wanted), ...Object.keys(actual)])) {
      if (wanted[name] !== actual[name]) {
        errors.push(`npm-shrinkwrap.json ${field}["${name}"] differs from package.json`)
      }
    }
  }
}

const sdkDep = pkg.dependencies && pkg.dependencies['@qvac/sdk']
if (typeof sdkDep !== 'string') {
  errors.push('dependencies["@qvac/sdk"] is missing')
} else if (/^(file:|link:)/.test(sdkDep)) {
  const snapshot = snapshots.get('@qvac/sdk')
  if (sdkDep !== 'file:vendor/qvac/sdk' || !snapshot) {
    errors.push(
      `dependencies["@qvac/sdk"] uses an unverified local path ("${sdkDep}"); only bundled file:vendor/qvac/sdk is allowed`
    )
  } else {
    if (!rangeAllowsCommandsSubpath(snapshot.manifest.version)) {
      errors.push('Bundled SDK predates the commands export')
    }
    const commands = snapshot.manifest.exports?.['./commands']
    const targets = exportTargets(commands)
    if (!targets.some((target) => /\.[cm]?js$/.test(target))) {
      errors.push('Bundled SDK must export executable ./commands')
    }
    for (const target of targets) {
      const file = path.resolve(snapshot.directory, target)
      if (
        !target.startsWith('./') ||
        !file.startsWith(snapshot.directory + path.sep) ||
        !fs.existsSync(file)
      ) {
        errors.push(`Bundled SDK commands export is missing or invalid: ${target}`)
      }
    }
  }
} else if (!rangeAllowsCommandsSubpath(sdkDep)) {
  errors.push(
    `dependencies["@qvac/sdk"] is "${sdkDep}" — must allow ` +
      '@qvac/sdk@0.12.0 or later (the first release with the ./commands subpath)'
  )
}

const preinstall = pkg.scripts && pkg.scripts.preinstall
if (typeof preinstall === 'string' && preinstall.includes('preinstall-build-local-sdk')) {
  errors.push(`scripts.preinstall still wires the monorepo helper ("${preinstall}")`)
}

if (errors.length === 0) {
  process.exit(0)
}

const message = [
  '',
  'Cannot publish @qvac/cli — dependency metadata is not ready.',
  '',
  ...errors.map((e) => `  • ${e}`),
  '',
  'Regenerate npm-shrinkwrap.json, verify bundled vendor snapshots and rebuild before publishing.',
  ''
].join('\n')

console.error(message)
process.exit(1)

// Minimal range check — avoids pulling in `semver` as a runtime dep just for
// publish-time validation. Accepts caret/tilde/range/comparator forms that
// can include 0.12.0 or higher, and rejects anything pinned to 0.11.x.
function rangeAllowsCommandsSubpath(range) {
  const trimmed = range.trim()

  // Wildcards / "any version" — trust the publisher.
  if (trimmed === '*' || trimmed === 'x' || trimmed === '' || trimmed === 'latest') {
    return true
  }

  // Caret/tilde forms: ^X.Y[.Z], ~X.Y[.Z]
  const caretTilde = trimmed.match(/^[\^~](\d+)\.(\d+)(?:\.(\d+))?/)
  if (caretTilde) {
    const major = Number(caretTilde[1])
    const minor = Number(caretTilde[2])
    if (major > 0) return true
    if (major === 0 && minor >= 12) return true
    return false
  }

  // Bare X.Y.Z or X.Y — accept anything strictly >= 0.12.0.
  const bare = trimmed.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/)
  if (bare) {
    const major = Number(bare[1])
    const minor = Number(bare[2])
    if (major > 0) return true
    if (major === 0 && minor >= 12) return true
    return false
  }

  // >=X.Y.Z forms — accept anything where the lower bound is >= 0.12.0.
  const gte = trimmed.match(/^>=?\s*(\d+)\.(\d+)/)
  if (gte) {
    const major = Number(gte[1])
    const minor = Number(gte[2])
    if (major > 0) return true
    if (major === 0 && minor >= 12) return true
    return false
  }

  // Unknown form — let the publisher decide.
  return true
}

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(exportTargets)
  return []
}

function verifySnapshot(name, spec) {
  if (!spec.startsWith('file:vendor/') || spec.includes('..') || spec.includes('\\')) {
    throw new Error(`${name} uses an unsupported local dependency: ${spec}`)
  }
  if (!Array.isArray(pkg.bundledDependencies) || !pkg.bundledDependencies.includes(name)) {
    throw new Error(`${name} local snapshot is not listed in bundledDependencies`)
  }
  if (!pkg.files?.includes('vendor/**')) throw new Error('Package files must include vendor/**')
  const directory = path.resolve(root, spec.slice(5))
  const real = fs.realpathSync(directory)
  if (!real.startsWith(fs.realpathSync(path.join(root, 'vendor')) + path.sep)) {
    throw new Error(`${name} snapshot resolves outside vendor/`)
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  if (
    manifest.name !== name ||
    typeof manifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+/.test(manifest.version)
  ) {
    throw new Error(`${name} snapshot has invalid package name/version`)
  }
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'PROVENANCE.json'), 'utf8'))
  const hashes = provenance.sha256 || provenance.files
  if (!hashes || typeof hashes !== 'object' || typeof hashes['package.json'] !== 'string') {
    throw new Error(`${name} snapshot has no package/file provenance hashes`)
  }
  for (const [relative, expected] of Object.entries(hashes)) {
    const file = path.resolve(directory, relative)
    if (
      !file.startsWith(directory + path.sep) ||
      !fs.statSync(file).isFile() ||
      fs.lstatSync(file).isSymbolicLink()
    ) {
      throw new Error(`${name} has invalid provenance path: ${relative}`)
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    if (actual !== expected) throw new Error(`${name} snapshot hash mismatch: ${relative}`)
  }
  verifyExports(name, directory, manifest)
  return { directory, manifest }
}

function verifyInstalledSnapshot(name, snapshot) {
  const installed = path.join(root, 'node_modules', name)
  if (!fs.existsSync(installed) || fs.lstatSync(installed).isSymbolicLink()) {
    throw new Error(`${name} must be installed as a bundled snapshot; run npm run pack:local`)
  }
  const provenance = JSON.parse(
    fs.readFileSync(path.join(snapshot.directory, 'PROVENANCE.json'), 'utf8')
  )
  const hashes = { ...(provenance.sha256 || provenance.files), ...provenance.assets }
  for (const [relative, expected] of Object.entries(hashes)) {
    const file = path.resolve(installed, relative)
    if (
      !file.startsWith(installed + path.sep) ||
      !fs.existsSync(file) ||
      fs.lstatSync(file).isSymbolicLink()
    ) {
      throw new Error(`${name} bundled snapshot is missing a regular file: ${relative}`)
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    if (actual !== expected) {
      throw new Error(`${name} bundled snapshot differs from reviewed vendor files: ${relative}`)
    }
  }
}

// Check exact targets even when a snapshot generator accidentally omitted a
// public file from both the snapshot and its otherwise consistent hash inventory.
function verifyExports(name, directory, manifest) {
  for (const target of exportTargets(manifest.exports)) {
    if (target.includes('*')) continue
    // SDK 0.22.0's published archive also omits this target. Its existing Expo
    // withMobileBundle plugin generates it for the consuming mobile application.
    if (
      name === '@qvac/sdk' &&
      manifest.version === '0.22.0' &&
      target === './dist/worker.mobile.bundle.js'
    ) {
      continue
    }
    const file = path.resolve(directory, target)
    if (
      !target.startsWith('./') ||
      !file.startsWith(directory + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      throw new Error(`${name} snapshot export is missing or invalid: ${target}`)
    }
  }
}
