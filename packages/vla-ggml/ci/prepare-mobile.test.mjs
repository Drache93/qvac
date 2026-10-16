import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FIXTURES, latestDate, urlConfig } from './prepare-mobile.mjs'

test('the newest dated model directory wins', () => {
  assert.equal(
    latestDate(
      '                           PRE 2026-04-30/\n                           PRE 2026-05-02/\n'
    ),
    '2026-05-02'
  )
  assert.throws(() => latestDate(''), /no dated/)
})

test('size and sha256 are baked only when known', () => {
  assert.deepEqual(urlConfig({ url: 'u', size: '12', sha256: '' }), {
    modelUrl: 'u',
    sizeBytes: 12
  })
  assert.deepEqual(urlConfig({ url: 'u', size: undefined, sha256: 'ab' }), {
    modelUrl: 'u',
    sha256: 'ab'
  })
})

test('the fixtures it bundles exist', () => {
  const assets = fileURLToPath(new URL('../test/integration/assets/', import.meta.url))
  for (const f of FIXTURES) assert.ok(existsSync(join(assets, f)), f)
})
