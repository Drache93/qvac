import test from 'node:test'
import assert from 'node:assert/strict'

import { findApk } from './build-android-app.mjs'

test('the aligned release APK is picked', () => {
  assert.equal(findApk(['debug/app-debug.apk', 'release/app-release-unaligned.apk', 'release/app-release.apk', 'release/output.json']), 'release/app-release.apk')
  assert.equal(findApk(['debug/app-debug.apk']), undefined)
})
