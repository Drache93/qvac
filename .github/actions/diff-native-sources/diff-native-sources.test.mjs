import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import { diffBase, isNative, nativeHash } from './diff-native-sources.mjs'

const OLD_GREP = String.raw`\.(cpp|hpp|c|h)$|CMakeLists\.txt$|vcpkg\.json$|vcpkg-configuration\.json$|/vcpkg/|vcpkg-overlays/|cmake/qvac-addon/`
const sha256 = 'command -v sha256sum >/dev/null && sha256sum || shasum -a 256'

test('the hash equals the old git ls-tree | grep -E | sha256sum pipeline', () => {
  for (const workdir of ['packages/vla-ggml', 'packages/fabric', 'packages/sdk']) {
    const args = ['-r', 'HEAD', '--', workdir, 'vcpkg-overlays', 'cmake/qvac-addon']
    const tree = execFileSync('git', ['ls-tree', ...args], { encoding: 'utf8' })
    const old = execFileSync('bash', ['-c', `git ls-tree ${args.join(' ')} | grep -E '${OLD_GREP}' | (${sha256}) | cut -c1-16`], {
      encoding: 'utf8',
    })
    assert.equal(nativeHash(tree), old.trim(), workdir)
  }
})

test('native files are sources, CMake, vcpkg manifests and the shared overlays', () => {
  const w = 'packages/vla-ggml'
  for (const f of [`${w}/addon/a.cpp`, `${w}/x/b.h`, `${w}/CMakeLists.txt`, `${w}/test/CMakeLists.txt`, `${w}/vcpkg.json`,
    `${w}/vcpkg/ports/p.cmake`, 'vcpkg-overlays/triplets/x.cmake', 'cmake/qvac-addon/a.cmake']) {
    assert.equal(isNative(f, w), true, f)
  }
  for (const f of [`${w}/index.js`, `${w}/test/vcpkg.json`, 'packages/fabric/a.cpp', `${w}x/a.cpp`]) {
    assert.equal(isNative(f, w), false, f)
  }
})

test('the diff base follows how the head moved on this event', () => {
  const s = { baseSha: 'base', headSha: 'head', beforeSha: '' }
  assert.equal(diffBase({ ...s, action: 'opened', beforeSha: 'prev' }), 'base')
  assert.equal(diffBase({ ...s, action: 'synchronize', beforeSha: 'prev' }), 'prev')
  assert.equal(diffBase({ ...s, action: 'labeled' }), 'head')
  assert.equal(diffBase({ ...s, action: 'synchronize', beforeSha: 'head' }), 'head')
})
