import test from 'node:test'
import assert from 'node:assert/strict'

import { decide, hasWritePermission, isApproved } from './check-pr-trust.mjs'

const pr = {
  event: 'pull_request_target',
  action: 'opened',
  isDraft: false,
  headRepo: 'someone/qvac',
  baseRepo: 'tetherto/qvac',
  hasWrite: false,
  approved: false,
  label: '',
  labels: [],
}

test('non-PR events are authorized', () => {
  assert.equal(decide({ ...pr, event: 'workflow_dispatch' }).allowed, true)
  assert.equal(decide({ ...pr, event: 'push' }).allowed, true)
})

test('drafts are blocked, even from the same repo', () => {
  assert.equal(decide({ ...pr, isDraft: true, headRepo: 'tetherto/qvac' }).allowed, false)
})

test('same-repo PRs are authorized, case-insensitively', () => {
  assert.equal(decide({ ...pr, headRepo: 'TetherTo/QVAC' }).allowed, true)
})

test('an empty head repo is treated as a fork, not as same-repo', () => {
  assert.equal(decide({ ...pr, headRepo: '' }).allowed, false)
})

test('write permission does not exempt a fork without SHA-bound approval', () => {
  assert.equal(decide({ ...pr, hasWrite: true }).allowed, false)
  assert.equal(decide({ ...pr, hasWrite: true, approved: true }).allowed, true)
})

test('forks need SHA-bound approval when no label is required', () => {
  assert.equal(decide(pr).allowed, false)
  assert.equal(decide({ ...pr, approved: true }).allowed, true)
})

test('a required label is needed in addition to approval', () => {
  const labelled = { ...pr, label: 'safe-to-test' }
  assert.equal(decide({ ...labelled, approved: true }).allowed, false)
  assert.equal(decide({ ...labelled, labels: ['safe-to-test'] }).allowed, false)
  assert.equal(decide({ ...labelled, labels: ['safe-to-test'], approved: true }).allowed, true)
  assert.equal(decide({ ...labelled, action: 'synchronize', approved: true }).allowed, false)
  assert.equal(decide({ ...labelled, labels: null, approved: true }).allowed, false)
})

test('approval is the newest status for the context', () => {
  const statuses = [
    { context: 'qvac/fork-verified', state: 'failure' },
    { context: 'qvac/fork-verified', state: 'success' },
  ]
  assert.equal(isApproved(statuses), false)
  assert.equal(isApproved(statuses.slice(1)), true)
  assert.equal(isApproved([{ context: 'other', state: 'success' }]), false)
  assert.equal(isApproved(null), false)
})

test('write means admin or write in the permission field', () => {
  assert.equal(hasWritePermission({ permission: 'admin' }), true)
  assert.equal(hasWritePermission({ permission: 'write' }), true)
  assert.equal(hasWritePermission({ permission: 'read' }), false)
  assert.equal(Boolean(hasWritePermission(null)), false)
})
