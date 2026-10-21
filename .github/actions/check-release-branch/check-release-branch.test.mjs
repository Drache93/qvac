import test from 'node:test'
import assert from 'node:assert/strict'

import { parseRelease, problems } from './check-release-branch.mjs'

test('the branch names the package directory and the version', () => {
  assert.deepEqual(parseRelease('release-vla-ggml-0.33.0'), { dir: 'vla-ggml', version: '0.33.0' })
  assert.throws(() => parseRelease('release-vla-ggml'), /expected release-<package dir>-<x.y.z>/)
  assert.throws(() => parseRelease('main'), /expected/)
})

test('exactly the branch package, at the branch version, passes', () => {
  assert.deepEqual(problems({ ref: 'release-vla-ggml-0.33.0', packages: ['vla-ggml'], version: '0.33.0' }), [])
  assert.deepEqual(problems({ ref: 'release-vla-ggml-0.33.0', packages: ['vla-ggml'] }), [], 'no workdir, no version check')
})

test('another package, a second package, a short name or another version fails', () => {
  assert.equal(problems({ ref: 'release-vla-ggml-0.33.0', packages: ['llm-llamacpp'] }).length, 1)
  assert.equal(problems({ ref: 'release-vla-ggml-0.33.0', packages: ['vla-ggml', 'fabric'] }).length, 1)
  assert.equal(problems({ ref: 'release-vla-0.33.0', packages: ['vla-ggml'] }).length, 1)
  assert.equal(problems({ ref: 'release-vla-ggml-0.33.0', packages: [] }).length, 1)
  assert.match(problems({ ref: 'release-vla-ggml-0.33.0', packages: ['vla-ggml'], version: '0.33.1' })[0], /releases 0\.33\.0, but .* is 0\.33\.1/)
})
