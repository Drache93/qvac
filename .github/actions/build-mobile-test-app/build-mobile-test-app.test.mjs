import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { build, checkMobileTests, extendTimeout, installerArgs } from './build-mobile-test-app.mjs'

test('a package without .cjs mobile tests is refused', () => {
  const d = mkdtempSync(join(tmpdir(), 'mt-'))
  assert.throws(() => checkMobileTests(d), /no .cjs tests/)
  mkdirSync(join(d, 'test/mobile'), { recursive: true })
  writeFileSync(join(d, 'test/mobile/a.cjs'), '')
  assert.doesNotThrow(() => checkMobileTests(d))
})

test('the per-test ceiling is raised, and a generator change is caught', () => {
  const gen = "{ timeout: 1200000, msg: 'did not complete within 20 minutes' }"
  assert.equal(extendTimeout(gen, 60), "{ timeout: 3600000, msg: 'did not complete within 60 minutes' }")
  assert.throws(() => extendTimeout('timeout: 5', 60), /no generated per-test timeout/)
  assert.throws(() => extendTimeout(gen, 0), /positive/)
})

test('dependency prebuilds reach the platform package installer', () => {
  const args = installerArgs('.', '/w/pkg', '@qvac/fabric=/tmp/fab\n')
  assert.deepEqual(args.slice(1), ['--app-dir', '.', '--addon-dir', '/w/pkg', '--prebuilds', '@qvac/fabric=/tmp/fab'])
})

test('the app is built, linked twice, and its timeout patched', () => {
  const root = mkdtempSync(join(tmpdir(), 'app-'))
  const addon = join(root, 'pkg')
  const app = join(root, 'app')
  mkdirSync(join(addon, 'test/mobile'), { recursive: true })
  writeFileSync(join(addon, 'test/mobile/a.cjs'), '')
  for (const d of ['backend', 'e2e/tests', 'node_modules/@qvac/x']) mkdirSync(join(app, d), { recursive: true })
  writeFileSync(join(app, 'backend/backend.cjs'), '')
  writeFileSync(join(app, 'node_modules/@qvac/x/package.json'), '{}')
  writeFileSync(join(app, 'e2e/tests/app.test.js'), 'timeout: 1200000,')
  const calls = []
  build({ platform: 'Android', appDir: app, addonDir: addon, npmName: '@qvac/x', timeoutMinutes: '60', run: (c, a) => calls.push(`${c} ${a.join(' ')}`) })
  assert.equal(calls.filter((c) => c.includes('bare-link --preset android')).length, 2)
  assert.equal(readFileSync(join(app, 'e2e/tests/app.test.js'), 'utf8'), 'timeout: 3600000,')
})
