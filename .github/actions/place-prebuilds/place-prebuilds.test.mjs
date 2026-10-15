import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { place } from './place-prebuilds.mjs'

function bundle(dirs) {
  const s = mkdtempSync(join(tmpdir(), 'bundle-'))
  for (const d of dirs) {
    mkdirSync(join(s, d), { recursive: true })
    writeFileSync(join(s, d, 'f'), '')
  }
  return s
}

test('a whole bundle or one platform is placed', () => {
  const s = bundle(['linux-x64', 'darwin-arm64'])
  assert.deepEqual(place({ staging: s, dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'prebuilds') }).sort(), ['darwin-arm64', 'linux-x64'])
  assert.deepEqual(place({ staging: s, dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'prebuilds'), platform: 'linux', arch: 'x64' }), ['linux-x64'])
  assert.throws(() => place({ staging: s, dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'p'), platform: 'win32', arch: 'x64' }), /No 'win32-x64/)
})

test('non-platform directories fail unless allowed, and an empty bundle fails', () => {
  const s = bundle(['linux-x64', 'include'])
  assert.throws(() => place({ staging: s, dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'p') }), /include under prebuilds/)
  assert.doesNotThrow(() => place({ staging: s, dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'p'), extraDirs: ['include'] }))
  assert.throws(() => place({ staging: mkdtempSync(join(tmpdir(), 'e-')), dest: join(mkdtempSync(join(tmpdir(), 'd-')), 'p') }), /missing or empty/)
})
