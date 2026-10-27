// Build an optional runtime release from installed dependencies; patch provider bytes in memory.
// No network access: install the documented build dependencies before running this.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { planPackagePatch } from './patch-dependencies.mjs'
const require = createRequire(import.meta.url)
const traverse = require('bare-module-traverse')
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
// pyodideSource allows a verified local upstream archive to be staged without installing it.
export function buildProvider(id, destination, { pyodideSource } = {}) {
  if (!['python', 'quickjs'].includes(id) || !destination) {
    throw new Error('Usage: node scripts/build-provider.mjs python|quickjs NEW_DIRECTORY')
  }
  const output = path.resolve(destination)
  if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`)
  const harness = path.join(root, 'node_modules/@qvac/harness')
  const files = new Map()
  const pyodide = path.join(root, 'node_modules/pyodide')
  const pyodideInput = path.resolve(pyodideSource || pyodide)
  const patched = new Map()
  if (id === 'python') {
    for (const change of planPackagePatch('pyodide@314.0.2', {
      target: pyodideInput,
      patch: path.join(harness, 'patches/pyodide@314.0.2.patch')
    })) {
      patched.set(
        path.join(pyodide, path.relative(pyodideInput, change.destination)),
        Buffer.from(change.after)
      )
    }
  }
  function inputPath(name) {
    return name === pyodide || name.startsWith(pyodide + path.sep)
      ? path.join(pyodideInput, path.relative(pyodide, name))
      : name
  }
  function read(url) {
    const name = fileURLToPath(url)
    try {
      const bytes = patched.get(name) || fs.readFileSync(inputPath(name))
      if (!name.startsWith(root + path.sep)) {
        throw new Error(`Provider dependency escaped build root: ${name}`)
      }
      files.set(name, bytes)
      return bytes
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return null
      throw error
    }
  }
  function* list(url) {
    const name = fileURLToPath(url)
    if (patched.has(name)) {
      yield url
      return
    }
    const input = inputPath(name)
    if (!fs.existsSync(input)) return
    if (fs.statSync(input).isFile()) {
      yield url
      return
    }
    for (const entry of fs.readdirSync(input)) yield* list(pathToFileURL(path.join(name, entry)))
  }
  const entry = path.join(harness, `dist-lib/plugins/${id}/index.js`)
  const entries = [entry]
  if (id === 'python') {
    entries.push(path.join(harness, 'dist-lib/plugins/python/worker/entry.js'))
    entries.push(path.join(harness, 'dist-lib/plugins/python/worker/interrupt-deadline.js'))
  }
  for (const entry of entries) {
    for (const dependency of traverse(
      pathToFileURL(entry),
      {
        resolve: traverse.resolve.bare,
        hosts: [`${process.platform}-${process.arch}`],
        defer: ['module']
      },
      read,
      list
    )) {
      void dependency
    }
  }
  // The wheel manifest names files dynamically; those files are part of the same release.
  if (id === 'python') {
    for (const url of list(pathToFileURL(path.join(harness, 'wheels')))) read(url)
    // New patch files are not present in pristine archives and may be imported dynamically.
    for (const name of patched.keys()) read(pathToFileURL(name))
    // Patched Emscripten imports some compatibility shims dynamically.
    for (const url of list(pathToFileURL(path.join(root, 'node_modules/pyodide')))) {
      if (!url.pathname.endsWith('.map') && !url.pathname.endsWith('.d.ts')) read(url)
    }
  }
  // Preserve the licenses of every package whose implementation is included.
  for (const name of [...files.keys()].filter((name) => path.basename(name) === 'package.json')) {
    for (const file of fs.readdirSync(inputPath(path.dirname(name)))) {
      if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(file)) {
        const absolute = path.join(path.dirname(name), file)
        if (fs.statSync(inputPath(absolute)).isFile()) read(pathToFileURL(absolute))
      }
    }
  }
  fs.mkdirSync(output, { recursive: true })
  const assets = []
  for (const [name, bytes] of files) {
    const relative = path.join('runtime', path.relative(root, name))
    const target = path.join(output, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
    assets.push(relative.split(path.sep).join('/'))
  }
  const runtimeEntry = './runtime/' + path.relative(root, entry).split(path.sep).join('/')
  fs.writeFileSync(
    path.join(output, 'release.cjs'),
    `module.exports = { format: 1, id: ${JSON.stringify(id)}, harnessAPI: 1, platform: ${JSON.stringify(process.platform)}, arch: ${JSON.stringify(process.arch)}, entry: require.asset(${JSON.stringify(runtimeEntry)}) }\n`
  )
  const version = JSON.parse(fs.readFileSync(path.join(harness, 'package.json'))).version
  fs.writeFileSync(
    path.join(output, 'provider.json'),
    JSON.stringify(
      {
        id,
        name: `@qvac/provider-${id}`,
        version,
        abi: 1,
        platforms: [`${process.platform}-${process.arch}`],
        assets: assets.sort()
      },
      null,
      2
    ) + '\n'
  )
  console.log(
    JSON.stringify({
      id,
      directory: output,
      files: assets.length,
      bytes: [...files.values()].reduce((n, b) => n + b.length, 0)
    })
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildProvider(...process.argv.slice(2))
}
