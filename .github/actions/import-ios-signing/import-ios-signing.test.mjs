import test from 'node:test'
import assert from 'node:assert/strict'

import { checkBundleId, exportMethod } from './import-ios-signing.mjs'

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
