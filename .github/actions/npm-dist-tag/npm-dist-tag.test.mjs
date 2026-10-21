import test from 'node:test'
import assert from 'node:assert/strict'

import { decide, latestFrom } from './npm-dist-tag.mjs'

test('an explicit tag other than latest is used as given', () => {
  assert.equal(decide({ version: '1.2.0', latest: '9.0.0', tag: 'release-1.x' }), 'release-1.x')
})

test('a stable version at or above npm latest gets latest, an older one or a prerelease gets release-major.minor', () => {
  assert.equal(decide({ version: '1.2.0', latest: '1.2.0', tag: 'latest' }), 'latest')
  assert.equal(decide({ version: '1.3.0', latest: '1.2.9' }), 'latest')
  assert.equal(decide({ version: '1.1.5', latest: '1.2.0' }), 'release-1.1')
  assert.equal(decide({ version: '2.0.0-rc.1', latest: '1.2.0' }), 'release-2.0')
})

test('a never-published package starts from 0.0.0, and any other registry failure stops', () => {
  assert.equal(latestFrom({ status: 0, stdout: '"1.4.0"' }), '1.4.0')
  assert.equal(latestFrom({ status: 0, stdout: '' }), '0.0.0')
  assert.equal(latestFrom({ status: 1, stdout: '{"error":{"code":"E404"}}' }), '0.0.0')
  assert.throws(() => latestFrom({ status: 1, stdout: '{"error":{"code":"E500"}}' }), /npm view failed/)
  assert.throws(() => latestFrom({ status: 1, stdout: '' }), /npm view failed/)
})
