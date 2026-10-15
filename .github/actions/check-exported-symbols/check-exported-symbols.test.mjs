import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { providerDirs } from './check-exported-symbols.mjs'

test('platform packages are found beside and inside the provider, without duplicates', () => {
  const w = realpathSync(mkdtempSync(join(tmpdir(), 'sym-')))
  for (const d of ['node_modules/@qvac/fabric', 'node_modules/@qvac/fabric-linux-x64/prebuilds',
    'node_modules/@qvac/fabric/node_modules/@qvac/fabric-darwin-arm64/prebuilds', 'node_modules/@qvac/fabricate/prebuilds']) {
    mkdirSync(join(w, d), { recursive: true })
  }
  assert.deepEqual(providerDirs(w, '@qvac/fabric').map((d) => d.slice(w.length + 1)).sort(), [
    'node_modules/@qvac/fabric-linux-x64/prebuilds',
    'node_modules/@qvac/fabric/node_modules/@qvac/fabric-darwin-arm64/prebuilds',
  ])
  assert.deepEqual(providerDirs(w, ''), [])
  assert.deepEqual(providerDirs(w, '@qvac/absent'), [])
})
