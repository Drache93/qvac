import test from 'node:test'
import assert from 'node:assert/strict'

import { OUTPUTS, route } from './route-ci.mjs'

const pr = { event: 'pull_request_target', labels: [], headRepo: 'someone/qvac', isDraft: false }

test('trusted events enable every stage', () => {
  for (const event of ['workflow_dispatch', 'workflow_call', 'push', 'schedule']) {
    assert.ok(OUTPUTS.every((o) => route({ event }).hasOwnProperty(o) && route({ event })[o] === true))
  }
})

test('a ready PR with no labels runs only the baseline checks', () => {
  assert.deepEqual(route(pr), {
    run_verified_checks: true,
    run_prebuilds: false,
    run_cpp_tests: false,
    run_desktop: false,
    run_mobile: false,
  })
})

test('each label selects its stage, and desktop or mobile imply prebuilds', () => {
  assert.equal(route({ ...pr, labels: ['prebuilds'] }).run_prebuilds, true)
  assert.equal(route({ ...pr, labels: ['run-cpp-addon-tests'] }).run_cpp_tests, true)
  assert.equal(route({ ...pr, labels: ['run-cpp-addon-tests'] }).run_prebuilds, false)
  const desktop = route({ ...pr, labels: ['run-desktop-addon-tests'] })
  assert.equal(desktop.run_desktop && desktop.run_prebuilds, true)
  const mobile = route({ ...pr, labels: ['run-mobile-addon-tests'] })
  assert.equal(mobile.run_mobile && mobile.run_prebuilds, true)
})

test('drafts and a missing head repo route nothing', () => {
  const all = ['prebuilds', 'run-cpp-addon-tests', 'run-desktop-addon-tests', 'run-mobile-addon-tests']
  for (const r of [route({ ...pr, isDraft: true, labels: all }), route({ ...pr, headRepo: '', labels: all })]) {
    assert.ok(OUTPUTS.every((o) => r[o] === false))
  }
})

test('forks route the same as same-repo PRs', () => {
  const labels = ['prebuilds']
  assert.deepEqual(route({ ...pr, labels }), route({ ...pr, labels, headRepo: 'tetherto/qvac' }))
})

test('null or unknown labels are ignored', () => {
  assert.equal(route({ ...pr, labels: null }).run_verified_checks, true)
  assert.equal(route({ ...pr, labels: ['something-else'] }).run_prebuilds, false)
})
