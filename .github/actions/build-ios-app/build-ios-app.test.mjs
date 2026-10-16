import test from 'node:test'
import assert from 'node:assert/strict'

import { exportOptions, schemeFrom } from './build-ios-app.mjs'

test('the first scheme is used', () => {
  const list = 'Information about workspace:\n    Targets:\n        App\n\n    Schemes:\n        QvacAddonTester\n        Pods\n'
  assert.equal(schemeFrom(list), 'QvacAddonTester')
  assert.throws(() => schemeFrom('Targets:\n  App\n'), /no scheme/)
})

test('export options name the method, team and profile per bundle id', () => {
  const plist = exportOptions({ method: 'ad-hoc', teamId: 'T1', bundleId: 'io.tether.test.qvac', profileUuid: 'U-1' })
  assert.match(plist, /<key>method<\/key>\n {2}<string>ad-hoc<\/string>/)
  assert.match(plist, /<key>io\.tether\.test\.qvac<\/key>\n {4}<string>U-1<\/string>/)
  assert.match(exportOptions({ method: 'a&b', teamId: '', bundleId: 'x', profileUuid: '' }), /a&amp;b/)
})
