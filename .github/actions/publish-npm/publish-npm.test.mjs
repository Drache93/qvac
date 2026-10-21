import test from 'node:test'
import assert from 'node:assert/strict'

import { alreadyPublished, gate, publishArgs } from './publish-npm.mjs'

test('dev and tmp skip quietly; any other tag needs a release branch', () => {
  assert.equal(gate({ tag: 'dev', ref: 'refs/heads/main' }), false)
  assert.equal(gate({ tag: 'tmp', ref: 'refs/heads/tmp-x' }), false)
  assert.equal(gate({ tag: 'latest', ref: 'refs/heads/release-vla-ggml-0.33.0' }), true)
  assert.throws(() => gate({ tag: 'latest', ref: 'refs/heads/main' }), /release-\* branch only/)
})

test('a version npm has is skipped, a never-published package publishes, a registry error stops', () => {
  assert.equal(alreadyPublished({ status: 0, stdout: '["0.1.0","0.2.0"]' }, '0.2.0'), true)
  assert.equal(alreadyPublished({ status: 0, stdout: '"0.2.0"' }, '0.2.0'), true)
  assert.equal(alreadyPublished({ status: 0, stdout: '["0.1.0"]' }, '0.2.0'), false)
  assert.equal(alreadyPublished({ status: 1, stdout: '' }, '0.2.0'), false)
  assert.equal(alreadyPublished({ status: 1, stdout: '{"error":{"code":"E404"}}' }, '0.2.0'), false)
  assert.throws(() => alreadyPublished({ status: 1, stdout: '{"error":{"code":"E503"}}' }, '0.2.0'), /npm view failed/)
})

test('public releases carry provenance, restricted ones cannot', () => {
  assert.deepEqual(publishArgs('latest', 'public'), ['publish', '--tag', 'latest', '--access', 'public', '--provenance'])
  assert.deepEqual(publishArgs('release-0.3', 'restricted'), ['publish', '--tag', 'release-0.3', '--access', 'restricted'])
})
