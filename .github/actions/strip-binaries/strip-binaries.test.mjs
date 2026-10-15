import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { binaries, staticLibs, tools } from './strip-binaries.mjs'

test('shipped binaries and named executables are picked, nothing else', () => {
  const d = mkdtempSync(join(tmpdir(), 'strip-'))
  mkdirSync(join(d, 'linux-x64'))
  for (const f of ['linux-x64/a.bare', 'linux-x64/b.so', 'linux-x64/c.dylib', 'linux-x64/tool', 'linux-x64/x.a', 'readme.txt']) writeFileSync(join(d, f), '')
  assert.deepEqual(binaries(d, ['tool']).map((f) => f.slice(d.length + 1)).sort(), ['linux-x64/a.bare', 'linux-x64/b.so', 'linux-x64/c.dylib', 'linux-x64/tool'])
  assert.throws(() => binaries(d, ['../evil']), /Invalid executable basename/)
  assert.deepEqual(staticLibs(d).map((f) => f.slice(d.length + 1)), ['linux-x64/x.a'])
})

test('each platform uses the same tools as before', () => {
  assert.deepEqual(tools('ios').strip, ['strip', '-S'])
  assert.deepEqual(tools('linux').strip, ['strip', '--strip-debug'])
  assert.equal(tools('android', '/ndk').strip[0], '/ndk/bin/llvm-strip')
  assert.equal(tools('android', '/ndk').debug('f')[0], '/ndk/bin/llvm-readelf')
  assert.equal(tools('win32'), null)
})
