import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { overlay, validateTree } from '../overlay-prebuilds.mjs'

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'overlay-'))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    if (text !== null) writeFileSync(join(dir, rel), text)
  }
  return dir
}

const prebuilds = {
  'include/f.h': 'h',
  'share/qvac-fabric/c.cmake': 'c',
  'linux-x64/tetherto_fabric.bare': 'new',
  'darwin-arm64/lib.dylib': 'mac',
}

test('the prebuilds tree must be include/, share/ of .cmake files, and no symlinks', () => {
  assert.doesNotThrow(() => validateTree(tree(prebuilds)))
  assert.throws(() => validateTree(tree({ 'include/f.h': 'h' })), /needs include\/ and share\//)
  assert.throws(() => validateTree(tree({ ...prebuilds, 'share/x.sh': 'rm -rf' })), /non-cmake file under share/)
  const linked = tree(prebuilds)
  symlinkSync('/etc/passwd', join(linked, 'include/p'))
  assert.throws(() => validateTree(linked), /symlink/)
})

test('every installed copy gets the prebuilds, legacy names renamed, and is sliced', () => {
  const src = tree(prebuilds)
  const consumer = tree({ 'node_modules/@qvac/fabric/package.json': '{}', 'node_modules/@qvac/fabric/prebuilds/linux-x64/old.bare': 'old' })
  const sliced = []
  overlay({ src, pkg: '@qvac/fabric', searchRoots: [consumer, consumer] }, (c) => sliced.push(c))
  const dest = join(consumer, 'node_modules/@qvac/fabric/prebuilds')
  assert.equal(readFileSync(join(dest, 'linux-x64/qvac_fabric.bare'), 'utf8'), 'new')
  assert.equal(existsSync(join(dest, 'linux-x64/old.bare')), false)
  assert.equal(existsSync(join(dest, 'darwin-arm64/lib.dylib')), true)
  assert.equal(sliced.length, 1)
})

test('a platform key overlays only that platform, and must exist', () => {
  const src = tree(prebuilds)
  const consumer = tree({ 'node_modules/@qvac/fabric/package.json': '{}' })
  overlay({ src, pkg: '@qvac/fabric', searchRoots: [consumer], platformKey: 'linux-x64' }, () => {})
  assert.equal(existsSync(join(consumer, 'node_modules/@qvac/fabric/prebuilds/darwin-arm64')), false)
  assert.throws(() => overlay({ src, pkg: '@qvac/fabric', searchRoots: [consumer], platformKey: 'win32-x64' }, () => {}), /no win32-x64/)
})

test('a consumer without the dependency installed fails', () => {
  assert.throws(() => overlay({ src: tree(prebuilds), pkg: '@qvac/fabric', searchRoots: [tree({ 'x': '' })] }, () => {}), /no installed/)
})
