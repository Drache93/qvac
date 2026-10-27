'use strict'
// @qvac addons ship as real packages beside the bundle: ggml backends dlopen from disk (QVAC-21760)

const fs = require('fs')
const path = require('path')

// Listed, not scanned, so a new SDK plugin forces a decision; the test fails on an uncovered import
const QVAC_ADDON_PACKAGES = [
  '@qvac/llm-llamacpp',
  '@qvac/embed-llamacpp',
  '@qvac/tts-ggml',
  '@qvac/ocr-ggml',
  '@qvac/diffusion-cpp',
  '@qvac/asr-ggml',
  '@qvac/audiogen-ggml',
  '@qvac/translation-nmtcpp',
  // fabric is the shared ggml module
  '@qvac/fabric'
]

// Every native addon the sidecar can load before it seals; a new one is a reviewed change to this list
const NATIVE_ADDON_PACKAGES = [
  '@qvac/asr-ggml',
  '@qvac/audiogen-ggml',
  '@qvac/diffusion-cpp',
  '@qvac/embed-llamacpp',
  '@qvac/fabric',
  '@qvac/llm-llamacpp',
  '@qvac/translation-nmtcpp',
  '@qvac/tts-ggml',
  'bare-abort',
  'bare-bmp',
  'bare-broadcast-channel',
  'bare-buffer',
  'bare-channel',
  'bare-cpu-info',
  'bare-crypto',
  'bare-dns',
  'bare-exif',
  'bare-ffmpeg',
  'bare-fs',
  'bare-gif',
  'bare-gpu-info',
  'bare-heif',
  'bare-hrtime',
  'bare-ico',
  'bare-image-resample',
  'bare-inspect',
  'bare-jpeg',
  'bare-logger',
  'bare-module',
  'bare-module-lexer',
  'bare-os',
  'bare-path',
  'bare-pdfium',
  'bare-performance',
  'bare-pipe',
  'bare-png',
  'bare-posix',
  'bare-signals',
  'bare-stdio',
  'bare-storage',
  'bare-structured-clone',
  'bare-subprocess',
  'bare-svg',
  'bare-tcp',
  'bare-thread',
  'bare-tiff',
  'bare-tls',
  'bare-tty',
  'bare-type',
  'bare-type-stripper',
  'bare-url',
  'bare-webp',
  'bare-zlib',
  'fs-native-extensions',
  'quickbit-native',
  'rabin-native',
  'rocksdb-native',
  'simdle-native',
  'sodium-native',
  'udx-native'
]

// defer matches specifiers exactly, so list every subpath the SDK or a plugin imports, as written
const EXTRA_ADDON_SUBPATHS = {
  '@qvac/audiogen-ggml': ['binding.js'],
  '@qvac/diffusion-cpp': ['world', 'world.js']
}

function deferSpecifiers() {
  return QVAC_ADDON_PACKAGES.flatMap((pkg) => [
    pkg,
    `${pkg}/addonLogging`,
    `${pkg}/addonLogging.js`,
    ...(EXTRA_ADDON_SUBPATHS[pkg] ?? []).map((sub) => `${pkg}/${sub}`)
  ])
}

// The stow records each deferred import, so the bundle names the addons its plugins reach
function deferredAddonPackages(bundle) {
  const names = new Set()
  const visit = (value) => {
    if (typeof value !== 'string') {
      for (const child of Object.values(value)) {
        visit(child)
      }

      return
    }

    if (!value.startsWith('deferred:')) {
      return
    }

    const parts = value.slice('deferred:'.length).split('/')
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
    if (QVAC_ADDON_PACKAGES.includes(name)) {
      names.add(name)
    }
  }
  visit(bundle.resolutions)

  return [...names].sort()
}

// Runtime deps only, plus the per-host prebuild package any of them loads through `#host-addon`
function collectRuntimeClosure(nodeModulesDir, seeds = QVAC_ADDON_PACKAGES, hosts = []) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length > 0) {
    const name = queue.shift()
    if (seen.has(name)) {
      continue
    }

    const manifestPath = path.join(nodeModulesDir, name, 'package.json')
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `[addon-externals] cannot resolve "${name}" under ${nodeModulesDir} — ` +
          'the addon runtime closure is incomplete; run the package install first'
      )
    }

    seen.add(name)
    // fabric 0.18 moved its prebuilds to per-host packages, so a dependency can delegate too
    for (const host of hosts) {
      const platform = hostPackage(nodeModulesDir, name, host)
      if (platform !== null) {
        queue.push(platform)
      }
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const nested = nestedDeps(nodeModulesDir, name)
    for (const dep of nested) {
      queue.push(...Object.keys(readManifest(nodeModulesDir, name, dep).dependencies ?? {}))
    }

    queue.push(...Object.keys(manifest.dependencies ?? {}).filter((dep) => !nested.includes(dep)))
  }

  return [...seen].sort()
}

// Nested when the root copy is out of range; one level deep
function nestedDeps(nodeModulesDir, name) {
  return Object.keys(readManifest(nodeModulesDir, name).dependencies ?? {}).filter((dep) =>
    fs.existsSync(path.join(nodeModulesDir, name, 'node_modules', dep, 'package.json'))
  )
}

function readManifest(nodeModulesDir, name, nested) {
  const dir = nested ? path.join(name, 'node_modules', nested) : name

  return JSON.parse(fs.readFileSync(path.join(nodeModulesDir, dir, 'package.json'), 'utf8'))
}

// Read `#host-addon` rather than guess names: the addon's own binding does the same lookup
function hostPackage(nodeModulesDir, name, host) {
  const manifestPath = path.join(nodeModulesDir, name, 'package.json')
  if (!fs.existsSync(manifestPath)) {
    return null
  }

  const map = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).imports?.['#host-addon']
  if (!map) {
    return null
  }

  const [os, cpu] = host.split('-')
  let node = map[os]
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    node = node[cpu] ?? node.default
  }

  const candidates = Array.isArray(node) ? node : [node]

  return candidates.find((c) => typeof c === 'string' && c.startsWith('@')) ?? null
}

function hostPrebuildDir(nodeModulesDir, name, host) {
  const own = path.join(nodeModulesDir, name, 'prebuilds', host)
  if (fs.existsSync(own)) {
    return own
  }

  const platform = hostPackage(nodeModulesDir, name, host)
  if (platform === null) {
    return null
  }

  const delegated = [
    path.join(nodeModulesDir, platform, 'prebuilds', host),
    path.join(nodeModulesDir, platform, 'addon', 'prebuilds', host)
  ]

  return delegated.find((dir) => fs.existsSync(dir)) ?? null
}

// dev/test weight only (e.g. whisper's ~30MB of .raw fixtures), never runtime
const SKIP_DIRS = new Set(['node_modules', 'prebuilds', 'test', 'tests', '__tests__'])

// prebuilds are filtered to the packaged hosts so a linux-x64 app carries no iOS/Android binaries
function copyPackage(srcDir, destDir, hosts) {
  fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    fs.cpSync(path.join(srcDir, entry.name), path.join(destDir, entry.name), {
      recursive: true
    })
  }

  const prebuildsDir = path.join(srcDir, 'prebuilds')
  if (!fs.existsSync(prebuildsDir)) {
    return
  }

  for (const host of hosts) {
    const hostDir = path.join(prebuildsDir, host)
    if (!fs.existsSync(hostDir)) {
      continue
    }

    fs.cpSync(hostDir, path.join(destDir, 'prebuilds', host), { recursive: true })
  }
}

// A missing prebuild fails the build: a missing native addon is a broken app, cheap to catch here
function copyAddonExternals(
  nodeModulesDir,
  destNodeModulesDir,
  hosts,
  // lunte-disable-next-line qvac/max-params -- hosts copy this script; seeds trails as in collectRuntimeClosure
  seeds = QVAC_ADDON_PACKAGES
) {
  const closure = collectRuntimeClosure(nodeModulesDir, seeds, hosts)
  for (const name of closure) {
    const srcDir = path.join(nodeModulesDir, name)
    if (QVAC_ADDON_PACKAGES.includes(name)) {
      const missingHost = hosts.find((host) => hostPrebuildDir(nodeModulesDir, name, host) === null)
      if (missingHost !== undefined) {
        throw new Error(
          `[addon-externals] ${name} has no prebuild for host "${missingHost}" ` +
            `(${path.join(srcDir, 'prebuilds', missingHost)}, nor a platform package for it) — ` +
            'the packaged app would fail its model loads'
        )
      }
    }

    copyPackage(srcDir, path.join(destNodeModulesDir, name), hosts)
    for (const dep of nestedDeps(nodeModulesDir, name)) {
      copyPackage(
        path.join(srcDir, 'node_modules', dep),
        path.join(destNodeModulesDir, name, 'node_modules', dep),
        hosts
      )
    }
  }

  return closure
}

// Last occurrence wins so a nested copy is named by the package it actually is
function bundledPackageName(key) {
  const at = key.lastIndexOf('/node_modules/')
  if (at < 0) {
    return null
  }

  const rest = key.slice(at + '/node_modules/'.length).split('/')
  if (rest.length < 2) {
    return null
  }

  return rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]
}

// Judged from the bundle, not the list: a list-only check missed a new addon (audiogen-ggml)
function assertNoBundledAddonModules(bundleKeys, nodeModulesDir) {
  const offenders = []
  const addons = new Map()
  for (const key of bundleKeys) {
    const name = bundledPackageName(key)
    if (name === null) {
      continue
    }

    if (!addons.has(name)) {
      addons.set(name, isAddonPackage(nodeModulesDir, name))
    }

    if (addons.get(name)) {
      offenders.push(key)
    }
  }

  if (offenders.length > 0) {
    const names = [...new Set(offenders.map(bundledPackageName))]
    throw new Error(
      '[addon-externals] addon module(s) were bundled instead of deferred — ' +
        `add ${names.join(', ')} to QVAC_ADDON_PACKAGES:\n  ` +
        offenders.join('\n  ')
    )
  }
}

// @qvac only: other bare-* addons bundle fine; only these dlopen ggml backends from prebuilds
function isAddonPackage(nodeModulesDir, name) {
  return name.startsWith('@qvac/') && isNativeAddon(nodeModulesDir, name)
}

// A split addon keeps its binary in a per-host package and names it through `#host-addon`
function isNativeAddon(nodeModulesDir, name) {
  const manifest = path.join(nodeModulesDir, name, 'package.json')
  if (!fs.existsSync(manifest)) {
    return false
  }

  const { addon, imports } = JSON.parse(fs.readFileSync(manifest, 'utf8'))

  return addon === true || imports?.['#host-addon'] !== undefined
}

// The bundle's addons are offloaded as .bare files; the deferred @qvac closure ships its own beside it
function nativeAddonPackages(artifactPaths, nodeModulesDir, seeds = QVAC_ADDON_PACKAGES) {
  const names = new Set()
  for (const file of artifactPaths) {
    if (file.endsWith('.bare')) {
      names.add(bundledPackageName(file))
    }
  }

  for (const name of collectRuntimeClosure(nodeModulesDir, seeds)) {
    if (isNativeAddon(nodeModulesDir, name)) {
      names.add(name)
    }
  }

  return [...names].sort()
}

// Exact both ways, so the list stays the audit of what the sidecar can load before it seals
function assertNativeAddonAllowlist(found, listed = NATIVE_ADDON_PACKAGES) {
  const unlisted = found.filter((name) => !listed.includes(name))
  const stale = listed.filter((name) => !found.includes(name))
  if (unlisted.length === 0 && stale.length === 0) {
    return
  }

  throw new Error(
    '[addon-externals] the native addons differ from NATIVE_ADDON_PACKAGES' +
      (unlisted.length > 0 ? `\n  not listed: ${unlisted.join(', ')}` : '') +
      (stale.length > 0 ? `\n  listed but gone: ${stale.join(', ')}` : '')
  )
}

module.exports = {
  QVAC_ADDON_PACKAGES,
  NATIVE_ADDON_PACKAGES,
  deferSpecifiers,
  deferredAddonPackages,
  collectRuntimeClosure,
  hostPackage,
  hostPrebuildDir,
  copyAddonExternals,
  assertNoBundledAddonModules,
  nativeAddonPackages,
  assertNativeAddonAllowlist
}
