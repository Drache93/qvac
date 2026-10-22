import test from 'node:test'
import assert from 'node:assert/strict'

import { consoleLink, judge, report, specFor, summary, wait } from './wait-devicefarm-runs.mjs'

const RUN = 'arn:aws:devicefarm:us-west-2:1:run:proj/run1'

test('console links and the run-to-spec legend', () => {
  assert.match(consoleLink(RUN), /projects\/proj\/runs\/run1$/)
  assert.match(consoleLink('arn:aws:devicefarm:us-west-2:1:job:proj/run1/job9'), /runs\/run1\/jobs\/job9$/)
  const specs = [{ name: 'a' }, { name: 'b' }]
  assert.deepEqual([0, 1, 2, 3].map((i) => specFor(i, 4, specs).name), ['a', 'a', 'b', 'b'])
  assert.equal(specFor(0, 1, []), undefined)
})

test('waiting ends when every run completes, or fails at the ceiling', async () => {
  const seq = { [RUN]: ['PENDING', 'RUNNING', 'COMPLETED'] }
  const logs = []
  await wait({ arns: [RUN], aws: async (a) => ({ run: { status: seq[a[2]].shift(), result: 'PASSED' } }), sleep: async () => {}, maxWait: 600, log: (l) => logs.push(l) })
  assert.ok(logs.some((l) => l.includes('acquired device')))
  await assert.rejects(wait({ arns: [RUN], aws: async () => ({ run: { status: 'RUNNING' } }), sleep: async () => {}, maxWait: 60, log: () => {} }), /after 60s/)
})

test('a long RUNNING stretch still logs a status line every three minutes', async () => {
  const states = [...Array(8).fill('RUNNING'), 'COMPLETED']
  const logs = []
  await wait({ arns: [RUN], aws: async () => ({ run: { status: states.shift(), result: 'PASSED' } }), sleep: async () => {}, maxWait: 600, log: (l) => logs.push(l) })
  assert.deepEqual(logs.filter((l) => /^\d+s: /.test(l)), ['180s: run 1 RUNNING'])
})

test('a device stopped by the timeout with every test passed counts as passed', () => {
  assert.equal(judge({ result: 'WARNED' }), true)
  assert.equal(judge({ result: 'STOPPED', counters: { passed: 3, failed: 0, errored: 0 } }), true)
  assert.equal(judge({ result: 'STOPPED', counters: { passed: 0 } }), false)
  assert.equal(judge({ result: 'FAILED', counters: { passed: 3 } }), false)
})

test('the report sums runs and fails on any failed device', async () => {
  const aws = async (a) => (a[0] === 'get-run'
    ? { run: { name: 'r', result: 'FAILED', counters: { total: 4, passed: 3, failed: 1, skipped: 0 } } }
    : { jobs: [{ arn: 'arn:aws:devicefarm:us-west-2:1:job:p/r/j', result: 'PASSED', device: { name: 'Pixel' } }, { arn: 'arn:aws:devicefarm:us-west-2:1:job:p/r/k', result: 'FAILED', device: { name: 'S25' } }] })
  const r = await report({ arns: [RUN], aws, specs: [] })
  assert.equal(r.result, 'FAILED')
  assert.deepEqual([r.total, r.passed, r.devicesPassed, r.devicesFailed], [4, 3, 1, 1])
  assert.match(summary(r, [RUN]), /:x: Device Farm test results[\s\S]*S25: FAILED/)
})
