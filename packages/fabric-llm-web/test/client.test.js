import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserRuntime } from '../src/client.js'

function fakeWorker() {
  const listeners = new Map()
  return {
    sent: [],
    terminated: false,
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    postMessage(message) {
      this.sent.push(message)
    },
    terminate() {
      this.terminated = true
    },
    receive(message) {
      listeners.get('message')({ data: message })
    },
    fail(type, message) {
      listeners.get(type)({ message })
    }
  }
}

test('correlates interleaved control and stream replies without losing buffered frames', async function () {
  const worker = fakeWorker()
  const runtime = createBrowserRuntime({ worker })
  const stream = runtime.streamCompletion({ requestId: 'run-1', modelId: 'model-1' })
  const first = stream.next()
  const completionId = worker.sent[0].id
  const cancellation = runtime.cancel({ requestId: 'run-1' })
  const cancelId = worker.sent[1].id
  const delta = { events: [{ type: 'contentDelta', seq: 0, text: 'Hi' }] }
  const terminal = {
    done: true,
    events: [{ type: 'completionDone', seq: 1, stopReason: 'cancelled' }]
  }
  worker.receive({ id: completionId, type: 'stream', value: delta })
  worker.receive({ id: cancelId, type: 'result', value: null })
  worker.receive({ id: completionId, type: 'stream', value: terminal })
  worker.receive({ id: completionId, type: 'end' })
  await cancellation
  assert.deepEqual(await first, { value: delta, done: false })
  assert.deepEqual(await stream.next(), { value: terminal, done: false })
  assert.equal((await stream.next()).done, true)
  runtime.close()
})

test('rejects a stream that ends before its terminal response', async function () {
  const worker = fakeWorker()
  const runtime = createBrowserRuntime({ worker })
  const stream = runtime.streamCompletion({ requestId: 'run-1' })
  const next = stream.next()
  worker.receive({ id: worker.sent[0].id, type: 'end' })
  await assert.rejects(next, /without a terminal response/)
  runtime.close()
})

test('rejects data after a terminal response', async function () {
  const worker = fakeWorker()
  const runtime = createBrowserRuntime({ worker })
  const stream = runtime.streamCompletion({ requestId: 'run-1' })
  const first = stream.next()
  const id = worker.sent[0].id
  worker.receive({ id, type: 'stream', value: { done: true, events: [] } })
  worker.receive({ id, type: 'stream', value: { events: [] } })
  worker.receive({ id, type: 'end' })
  await first
  await assert.rejects(stream.next(), /after its terminal response/)
  runtime.close()
})

for (const event of ['error', 'messageerror']) {
  test(`worker ${event} settles all pending requests and closes the runtime`, async function () {
    const worker = fakeWorker()
    const runtime = createBrowserRuntime({ worker })
    const load = runtime.loadModel({ modelSrc: 'https://example.com/model.gguf' })
    const stream = runtime.streamCompletion({ requestId: 'run-1' })
    const next = stream.next()
    const rejectedLoad = assert.rejects(load, /worker/)
    const rejectedStream = assert.rejects(next, /worker/)
    worker.fail(event, 'Browser worker crashed')
    await Promise.all([rejectedLoad, rejectedStream])
    assert.equal(worker.terminated, true)
    await assert.rejects(runtime.loadModel({}), /closed/)
  })
}

test('close interrupts a pending operation and is idempotent', async function () {
  const worker = fakeWorker()
  const runtime = createBrowserRuntime({ worker })
  const load = runtime.loadModel({ modelSrc: 'https://example.com/model.gguf' })
  const rejected = assert.rejects(load, /runtime closed/)
  runtime.close()
  runtime.close()
  await rejected
  assert.equal(worker.terminated, true)
})

test('synchronous worker send failure rejects its operation', async function () {
  const worker = fakeWorker()
  worker.postMessage = function () {
    throw new Error('Cannot clone request')
  }
  const runtime = createBrowserRuntime({ worker })
  await assert.rejects(runtime.loadModel({}), /Cannot clone request/)
  runtime.close()
})
