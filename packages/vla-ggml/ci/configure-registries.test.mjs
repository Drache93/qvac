import test from 'node:test'
import assert from 'node:assert/strict'

import { gitRewrites, npmrc } from './configure-registries.mjs'

test('@tetherto resolves from GitHub Packages and @qvac from npmjs', () => {
  const rc = npmrc({ NPM_TOKEN: 'n', GPR_TOKEN: 'g' })
  assert.match(rc, /^@tetherto:registry=https:\/\/npm\.pkg\.github\.com\/$/m)
  assert.match(rc, /^@qvac:registry=https:\/\/registry\.npmjs\.org\/$/m)
  assert.match(rc, /^\/\/npm\.pkg\.github\.com\/:_authToken=g$/m)
})

test('git rewrites match main per platform', () => {
  assert.deepEqual(gitRewrites('t', 'win32'), [['https://t:@github.com/', 'https://github.com/']])
  assert.equal(gitRewrites('t', 'linux').length, 2)
})
