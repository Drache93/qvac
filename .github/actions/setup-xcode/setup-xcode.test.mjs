import test from 'node:test'
import assert from 'node:assert/strict'

import { pickXcode, setup } from './setup-xcode.mjs'

const sdks = () => 'iOS SDKs:\n\tiOS 18.1 -sdk iphoneos18.1\n'

test('16.1 is preferred and 16.2 is the fallback', () => {
  assert.equal(pickXcode((p) => p.includes('16.2') || p.includes('16.1.app')), '/Applications/Xcode_16.1.app')
  assert.equal(pickXcode((p) => p.includes('16.2')), '/Applications/Xcode_16.2.app')
  assert.throws(() => pickXcode(() => false), /no Xcode/)
})

test('a hosted runner installs, a self-hosted one only checks', () => {
  const calls = []
  setup({ hosted: true, exists: () => true, has: () => true, run: (c, a) => (calls.push(`${c} ${a.join(' ')}`), sdks()) })
  assert.ok(calls.includes('brew install ninja'))
  const self = []
  setup({ hosted: false, exists: () => true, has: () => true, run: (c, a) => (self.push(c), sdks()) })
  assert.deepEqual(self, ['xcodebuild'])
  assert.throws(() => setup({ hosted: false, exists: () => true, has: (t) => t !== 'pod', run: sdks }), /pod is not on PATH/)
  assert.throws(() => setup({ hosted: false, exists: () => true, has: () => true, run: () => 'macOS SDKs' }), /no iOS SDK/)
})
