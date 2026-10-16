import test from 'node:test'
import assert from 'node:assert/strict'

import { plan, runNameBase, schedule } from './schedule-devicefarm-runs.mjs'

const env = { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_NUMBER: '7', GITHUB_RUN_ID: '99', GITHUB_RUN_ATTEMPT: '2', PLATFORM: 'Android' }

test('run names are unique to the attempt and the app upload', () => {
  assert.equal(runNameBase(env, {}, 'arn:aws:devicefarm:us-west-2:1:upload:p/u-1'), 'Manual-7-Android-99.2-u-1')
  assert.equal(runNameBase({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, { pull_request: { number: 42 } }, 'a/u'), 'PR-42-Android-99.2-u')
  assert.throws(() => runNameBase(env, {}, 'arn/'), /upload id/)
})

test('one run per spec and device, each pinned to one device', () => {
  const runs = plan({ specs: [{ name: 'Smol', arn: 's1' }, { name: 'Groot', arn: 's2' }], models: ['Google Pixel 9'], operator: 'EQUALS', platform: 'Android', base: 'B' })
  assert.deepEqual(runs.map((r) => r.name), ['B-Smol-Google_Pixel_9', 'B-Groot-Google_Pixel_9'])
  assert.deepEqual(runs[0].filter, { filters: [{ attribute: 'PLATFORM', operator: 'EQUALS', values: ['ANDROID'] }, { attribute: 'MODEL', operator: 'EQUALS', values: ['Google Pixel 9'] }], maxDevices: 1 })
  const p = (o) => () => plan({ specs: [{ name: 'a', arn: 'x' }], models: ['m'], operator: 'EQUALS', platform: 'iOS', base: 'B', ...o })
  assert.throws(p({ models: [] }), /no devices/)
  assert.throws(p({ specs: [{ name: 'a' }] }), /name and arn/)
  assert.throws(p({ specs: Array.from({ length: 5 }, (_, i) => ({ name: `${i}`, arn: 'x' })), models: Array.from({ length: 9 }, (_, i) => `m${i}`) }), /exceeds 40/)
})

test('a failure part way stops what was created, including runs found only by name', () => {
  const stopped = []
  let n = 0
  const aws = (args) => {
    if (args[0] === 'schedule-run') { if (++n === 2) throw new Error('throttled'); return { run: { arn: `r${n}` } } }
    if (args[0] === 'stop-run') return stopped.push(args[2])
    return { runs: [{ arn: 'r1', name: 'B-x', status: 'RUNNING' }, { arn: 'ghost', name: 'B-y', status: 'PENDING' }, { arn: 'done', name: 'B-z', status: 'COMPLETED' }, { arn: 'other', name: 'C-x', status: 'RUNNING' }] }
  }
  const runs = [{ name: 'B-x', spec: 's', filter: {} }, { name: 'B-y', spec: 's', filter: {} }]
  assert.throws(() => schedule({ runs, project: 'p', app: 'a', testPackage: 't', timeout: '120', base: 'B', aws }), /throttled/)
  assert.deepEqual(stopped, ['r1', 'ghost'])
})
