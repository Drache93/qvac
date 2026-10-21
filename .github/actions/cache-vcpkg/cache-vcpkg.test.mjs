import test from 'node:test'
import assert from 'node:assert/strict'

import { cacheDirFor, filesSources, hostCandidates, s3Sources } from './cache-vcpkg.mjs'

test('files mode takes a package directory, under src/ or not, and nothing else', () => {
  assert.equal(cacheDirFor('/w', 'src/packages/vla-ggml'), '/w/src/packages/vla-ggml/vcpkg/cache')
  assert.equal(cacheDirFor('/w', 'packages/vla-ggml'), '/w/packages/vla-ggml/vcpkg/cache')
  assert.throws(() => cacheDirFor('/w', 'packages/x\nEVIL=1'), /unexpected/)
  assert.throws(() => cacheDirFor('/w', '../etc'), /unexpected/)
})

test('s3 mode keys the bucket by platform and arch, and rejects odd values', () => {
  assert.equal(s3Sources({ bucket: 'b', platform: 'linux', arch: 'x64' }), 'clear;x-aws,s3://b/vcpkg-cache/linux-x64/,readwrite')
  assert.throws(() => s3Sources({ bucket: 'b', platform: 'linux;rm', arch: 'x64' }), /invalid/)
  assert.throws(() => s3Sources({ platform: 'linux', arch: 'x64' }), /cache-bucket/)
})

test('files mode writes the host layer only when trusted, and always the workspace', () => {
  assert.equal(filesSources({ hostDir: '/opt/c', cacheDir: '/w', trusted: true }), 'clear;files,/opt/c,write;files,/w,readwrite')
  assert.equal(filesSources({ hostDir: '/opt/c', cacheDir: '/w', trusted: false }), 'clear;files,/opt/c,read;files,/w,readwrite')
  assert.equal(filesSources({ hostDir: '', cacheDir: '/w', trusted: true }), 'clear;files,/w,readwrite')
})

test('host candidates follow the override, then the per-OS defaults', () => {
  assert.deepEqual(hostCandidates({ VCPKG_HOST_CACHE_DIR: '/x' }), ['/x'])
  assert.equal(hostCandidates({ RUNNER_OS: 'macOS' })[1], '/Users/Shared/qvac-vcpkg-cache')
  assert.equal(hostCandidates({ RUNNER_OS: 'Linux' })[1], '/var/tmp/qvac-vcpkg-cache')
  assert.equal(hostCandidates({ RUNNER_OS: 'Windows', LOCALAPPDATA: 'L' })[0], 'C:\\qvac\\vcpkg-cache')
})
