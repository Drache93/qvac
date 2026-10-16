import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFiles, uploadAll } from './upload-devicefarm.mjs'

function fakeAws(statuses) {
  let n = 0
  return (args) => (args[0] === 'create-upload' ? { upload: { url: 'https://s3/u', arn: `arn:${++n}` } } : { upload: { status: statuses.shift() } })
}

test('a path or a list of objects with a file is accepted', () => {
  assert.deepEqual(parseFiles('/t/app.apk', 'test-app-Android.apk'), [{ file: '/t/app.apk', uploadName: 'test-app-Android.apk' }])
  assert.deepEqual(parseFiles('[{"name":"Smol","file":"/t/s.yml"}]'), [{ name: 'Smol', file: '/t/s.yml' }])
})

test('each upload waits for SUCCEEDED and keeps its fields', async () => {
  const put = []
  const out = await uploadAll({
    items: [{ name: 'g', file: '/a.yml', grep: 'x' }], project: 'p', type: 'APPIUM_NODE_TEST_SPEC',
    aws: fakeAws(['INITIALIZED', 'PROCESSING', 'SUCCEEDED']), put: (f) => put.push(f), sleep: async () => {},
  })
  assert.deepEqual(out, [{ name: 'g', file: '/a.yml', grep: 'x', arn: 'arn:1' }])
  assert.deepEqual(put, ['/a.yml'])
})

test('a failed or stuck upload fails the step', async () => {
  const base = { items: [{ file: '/a' }], project: 'p', type: 't', put: () => {}, sleep: async () => {} }
  await assert.rejects(uploadAll({ ...base, aws: fakeAws(['FAILED']) }), /rejected/)
  await assert.rejects(uploadAll({ ...base, attempts: 2, aws: fakeAws(['INITIALIZED', 'INITIALIZED']) }), /never reached SUCCEEDED \(last INITIALIZED\)/)
})
