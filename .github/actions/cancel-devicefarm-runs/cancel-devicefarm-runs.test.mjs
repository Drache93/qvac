import test from 'node:test'
import assert from 'node:assert/strict'

import { cancel } from './cancel-devicefarm-runs.mjs'

test('only live runs are stopped', () => {
  const status = { a: 'RUNNING', b: 'COMPLETED', c: 'PENDING_DEVICE' }
  const stopped = []
  const t = cancel(['a', 'b', 'c', 'd'], (args) => {
    if (args[0] === 'stop-run') return stopped.push(args[2])
    if (!status[args[2]]) throw new Error('gone')
    return { run: { status: status[args[2]] } }
  })
  assert.deepEqual(stopped, ['a', 'c'])
  assert.deepEqual(t, { stopped: 2, finished: 2, failed: 0 })
})
