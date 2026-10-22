import test from 'node:test'
import assert from 'node:assert/strict'

import { checkBundleId, exportMethod, profileFrom } from './import-ios-signing.mjs'

test('the export method follows what the profile provisions', () => {
  assert.equal(exportMethod({ ProvisionsAllDevices: true }), 'enterprise')
  assert.equal(exportMethod({ ProvisionedDevices: ['u'], Entitlements: { 'get-task-allow': true } }), 'development')
  assert.equal(exportMethod({ ProvisionedDevices: ['u'], Entitlements: { 'get-task-allow': false } }), 'ad-hoc')
  assert.equal(exportMethod({ Entitlements: {} }), 'app-store')
})

test('the profile must be for the app bundle id', () => {
  assert.doesNotThrow(() => checkBundleId({ Entitlements: { 'application-identifier': 'TEAM.io.tether.test.qvac' } }, 'io.tether.test.qvac'))
  assert.throws(() => checkBundleId({ Entitlements: { 'application-identifier': 'TEAM.io.other' } }, 'io.tether.test.qvac'), /'io.other'/)
})

test('profile keys are read one by one, and a missing key reads as absent', () => {
  const keys = { ':UUID': 'u-1', ':ProvisionedDevices': 'Array {\n    00008110\n}', ':Entitlements:application-identifier': 'TEAM.io.tether.test.qvac', ':Entitlements:get-task-allow': 'false' }
  const profile = profileFrom((k) => keys[k] ?? null)
  assert.equal(profile.UUID, 'u-1')
  assert.equal(exportMethod(profile), 'ad-hoc')
  checkBundleId(profile, 'io.tether.test.qvac')
  assert.equal(exportMethod(profileFrom((k) => ({ ':UUID': 'u-2', ':ProvisionsAllDevices': 'true' })[k] ?? null)), 'enterprise')
  assert.equal(exportMethod(profileFrom((k) => ({ ':UUID': 'u-3' })[k] ?? null)), 'app-store')
})
