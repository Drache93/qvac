#!/usr/bin/env node
// Copies a dependency's PR-built prebuilds into every installed copy under the consumer.

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// share/ is include()d by CMake, so only regular .cmake files may sit there.
export function validateTree(src) {
  if (!existsSync(join(src, 'include')) || !existsSync(join(src, 'share'))) throw new Error(`${src} needs include/ and share/`)
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const child = rel ? `${rel}/${e.name}` : e.name
      if (e.isSymbolicLink()) throw new Error(`symlink in prebuilds: ${child}`)
      if (e.isDirectory()) walk(join(dir, e.name), child)
      else if (!e.isFile()) throw new Error(`non-regular file in prebuilds: ${child}`)
      else if (child.startsWith('share/') && !e.name.endsWith('.cmake')) throw new Error(`non-cmake file under share/: ${child}`)
    }
  }
  walk(src, '')
}

export function installedCopies(pkg, searchRoots) {
  const found = searchRoots.map((r) => join(r, 'node_modules', pkg)).filter((d) => existsSync(d) && statSync(d).isDirectory())
  return [...new Set(found)]
}

function replaceDir(from, to) {
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
}

function renameLegacy(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name)
    if (e.isDirectory()) renameLegacy(path)
    if (e.name.startsWith('tetherto_')) renameSync(path, join(dir, `qvac_${e.name.slice(9)}`))
  }
}

export function overlay({ src, pkg, searchRoots, platformKey = '' }, slice) {
  validateTree(src)
  const copies = installedCopies(pkg, searchRoots)
  if (!copies.length) throw new Error(`no installed ${pkg} under ${searchRoots.join(' ')}`)
  const platforms = platformKey
    ? [platformKey]
    : readdirSync(src).filter((d) => d.includes('-') && statSync(join(src, d)).isDirectory())
  for (const p of platforms) if (!existsSync(join(src, p))) throw new Error(`no ${p}/ in ${src}`)
  for (const copy of copies) {
    const dest = join(copy, 'prebuilds')
    for (const d of ['include', 'share', ...platforms]) replaceDir(join(src, d), join(dest, d))
    renameLegacy(dest)
    slice(copy)
    console.log(`Overlaid ${basename(src)} into ${dest}`)
  }
  return copies
}

function main() {
  const { values } = parseArgs({
    options: {
      workdir: { type: 'string' }, package: { type: 'string' }, src: { type: 'string' },
      platform: { type: 'string', default: '' }, arch: { type: 'string', default: '' }, tags: { type: 'string', default: '' },
      'search-dirs': { type: 'string', default: '' },
    },
  })
  const searchRoots = [values.workdir, process.env.GITHUB_WORKSPACE || '.', ...values['search-dirs'].split(' ')]
    .filter(Boolean)
    .map((d) => resolve(d))
  const platformKey = values.platform && values.arch ? `${values.platform}-${values.arch}${values.tags}` : ''
  const slicer = join(ROOT, 'scripts/ci/slice-platform-packages.mjs')
  overlay({ src: values.src, pkg: values.package, searchRoots, platformKey }, (copy) =>
    execFileSync('node', [slicer, '--link-local', '--workdir', copy, '--keep-dirs', 'include share'], { stdio: 'inherit' }),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
