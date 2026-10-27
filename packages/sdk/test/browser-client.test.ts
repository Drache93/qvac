import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBrowserClient,
  InferenceCancelledError,
  type BrowserRuntime
} from '../src/browser/index'

function runtime(overrides: Partial<BrowserRuntime> = {}): BrowserRuntime {
  return {
    async loadModel() {
      return 'model'
    },
    async *streamCompletion() {
      yield { type: 'completionStream', events: [{ type: 'contentDelta', seq: 0, text: 'Hello' }] }
      yield {
        type: 'completionStream',
        done: true,
        events: [
          { type: 'completionStats', seq: 1, stats: { generatedTokens: 1, backendDevice: 'gpu' } },
          { type: 'completionDone', seq: 2, stopReason: 'eos', raw: { fullText: 'Hello' } }
        ]
      }
    },
    async cancel() {},
    async unloadModel() {},
    close() {},
    ...overrides
  }
}

const params = { modelId: 'model', history: [{ role: 'user' as const, content: 'Hi' }] }

test('browser client uses SDK events/final and forwards lifecycle and canonical request', async () => {
  const calls: string[] = []
  const provider = runtime()
  const stream = provider.streamCompletion
  provider.streamCompletion = async function* (request) {
    assert.equal(request.type, 'completionStream')
    assert.equal(request.modelId, 'model')
    assert.equal(request.stream, true, 'browser completion streams by default')
    assert.ok(request.requestId)
    assert.deepEqual(request.generationParams, { predict: 16, temp: 0, seed: 7 })
    yield* stream(request)
  }
  provider.loadModel = async (options) => {
    assert.deepEqual(options, { modelSrc: 'https://example.com/model.gguf', ctxSize: 512 })
    calls.push('load')
    return 'model'
  }
  provider.unloadModel = async (options) => {
    assert.equal(options.modelId, 'model')
    calls.push('unload')
  }
  provider.close = () => {
    calls.push('close')
  }
  const client = createBrowserClient(provider)
  await client.loadModel({ modelSrc: 'https://example.com/model.gguf', ctxSize: 512 })
  const run = client.completion({ ...params, generationParams: { predict: 16, temp: 0, seed: 7 } })
  const events = []
  for await (const event of run.events) events.push(event)
  assert.deepEqual(
    events.map((event) => event.type),
    ['contentDelta', 'completionStats', 'completionDone']
  )
  assert.equal((await run.final).contentText, 'Hello')
  assert.equal((await run.final).raw.fullText, 'Hello')
  assert.equal((await run.stats)?.backendDevice, 'gpu')
  await client.unloadModel({ modelId: 'model' })
  await client.close()
  assert.deepEqual(calls, ['load', 'unload', 'close'])
})

test('browser cancellation preserves request ID, partial output and clean event termination', async () => {
  let release = () => {}
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  let activeRequestId: string | undefined
  const client = createBrowserClient(
    runtime({
      async *streamCompletion(request) {
        activeRequestId = request.requestId
        yield {
          type: 'completionStream',
          events: [{ type: 'contentDelta', seq: 0, text: 'partial' }]
        }
        await waiting
        yield {
          type: 'completionStream',
          done: true,
          events: [{ type: 'completionDone', seq: 1, stopReason: 'cancelled' }]
        }
      },
      async cancel(options) {
        assert.deepEqual(options, { requestId: activeRequestId })
        release()
      }
    })
  )
  const run = client.completion(params)
  assert.ok(run.requestId)
  const iterator = run.events[Symbol.asyncIterator]()
  assert.equal((await iterator.next()).value?.type, 'contentDelta')
  await client.cancel({ requestId: run.requestId })
  assert.equal((await iterator.next()).value?.type, 'completionDone')
  assert.equal((await iterator.next()).done, true)
  await assert.rejects(run.final, (error: Error) => {
    assert.ok(error instanceof InferenceCancelledError)
    assert.equal(error.partial.text, 'partial')
    return true
  })
})

test('browser stream EOF without terminal rejects consumers instead of hanging final', async () => {
  const client = createBrowserClient(
    runtime({
      async *streamCompletion() {
        yield {
          type: 'completionStream',
          events: [{ type: 'contentDelta', seq: 0, text: 'incomplete' }]
        }
      }
    })
  )
  const run = client.completion(params)
  await assert.rejects(run.final)
  await assert.rejects(async () => {
    for await (const event of run.events) void event
  })
})

test('browser client rejects unsupported input before runtime execution', () => {
  let called = false
  const client = createBrowserClient(
    runtime({
      async *streamCompletion() {
        called = true
      }
    })
  )
  // @ts-expect-error Browser PoC excludes tools at both type and runtime boundaries.
  assert.throws(() => client.completion({ ...params, tools: [] }))
  // @ts-expect-error Browser PoC preserves raw output and cannot separate reasoning yet.
  assert.throws(() => client.completion({ ...params, captureThinking: true }))
  assert.throws(() => client.completion({ ...params, generationParams: { predict: -1 } }))
  assert.throws(() =>
    client.completion({
      modelId: 'model',
      // @ts-expect-error Attachments need a separate browser model input implementation.
      history: [{ role: 'user', content: 'Hi', attachments: [] }]
    })
  )
  assert.throws(() => client.loadModel({ modelSrc: 'pear://model' }))
  assert.equal(called, false)
})
