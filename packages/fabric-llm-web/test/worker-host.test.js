import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkerHost } from '../src/worker-host.js'

function deferred() {
  let resolve
  const promise = new Promise(function (done) {
    resolve = done
  })
  return { promise, resolve }
}

function fixture({
  step,
  init,
  load,
  adapterVendor,
  workerfs = true,
  fetchModel
} = {}) {
  const messages = []
  const calls = []
  const files = new Map()
  const lifecycle = []
  let result
  const module = {
    HEAPU8: new Uint8Array(16),
    FS: {
      filesystems: { WORKERFS: workerfs ? {} : undefined },
      mkdir() {},
      mount(type, options, path) {
        assert.equal(type, module.FS.filesystems.WORKERFS)
        assert.equal(path, '/models')
        lifecycle.push('mount')
        for (const { name, data } of options.blobs)
          files.set(`${path}/${name}`, data)
      },
      unmount(path) {
        assert.equal(path, '/models')
        lifecycle.push('unmount')
        files.clear()
      }
    },
    ccall(name, _returnType, _types, args) {
      if (name === 'web_result') return JSON.stringify(result)
      const argument = args[0] === undefined ? undefined : JSON.parse(args[0])
      calls.push({ name, argument })
      lifecycle.push(name)
      return Promise.resolve(
        name === 'web_step'
          ? step?.()
          : name === 'web_init'
            ? init?.()
            : name === 'web_load'
              ? load?.()
              : {}
      ).then(function (value) {
        result = value ?? {}
        return result.error ? 1 : 0
      })
    }
  }
  const handle = createWorkerHost({
    post(message) {
      messages.push(message)
    },
    async probe() {
      return { shaderF16: true, adapter: { vendor: adapterVendor } }
    },
    async loadModule() {
      return module
    },
    fetchModel:
      fetchModel ??
      async function () {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-length': '3' }
        })
      }
  })
  async function loadModel() {
    await handle({
      id: 1,
      type: 'load',
      payload: { modelSrc: 'https://example.com/model.gguf', ctxSize: 512 }
    })
    const response = messages.find(function (message) {
      return message.id === 1 && message.type === 'result'
    })
    assert.ok(response, JSON.stringify(messages))
    return response.value
  }
  return { messages, calls, files, lifecycle, handle, loadModel }
}

test('mounts the acquired Blob read-only without copying the model into MEMFS', async function () {
  const context = fixture()
  const modelId = await context.loadModel()
  const file = context.files.get('/models/model.gguf')
  assert.ok(file instanceof Blob)
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3])
  assert.equal(
    context.calls.find((call) => call.name === 'web_load').argument.modelPath,
    '/models/model.gguf'
  )
  assert.ok(
    context.lifecycle.indexOf('mount') < context.lifecycle.indexOf('web_load')
  )
  await context.handle({ id: 2, type: 'unload', payload: { modelId } })
  assert.ok(
    context.lifecycle.indexOf('web_unload') <
      context.lifecycle.indexOf('unmount')
  )
  assert.equal(context.files.size, 0)
  await context.loadModel()
  assert.equal(context.files.size, 1)
})

test('rejects stale WASM artifacts lacking WORKERFS before downloading a model', async function () {
  const context = fixture({
    workerfs: false,
    fetchModel() {
      throw new Error('Must not download')
    }
  })
  await context.handle({
    id: 1,
    type: 'load',
    payload: { modelSrc: 'https://example.com/model.gguf' }
  })
  assert.match(context.messages.at(-1).error, /rebuilt with WORKERFS/)
  assert.equal(context.files.size, 0)
  assert.equal(context.calls.length, 0)
})

test('download failures leave no mount and permit a later retry', async function () {
  let attempts = 0
  const context = fixture({
    fetchModel() {
      attempts++
      if (attempts === 1) throw new Error('Network disconnected')
      return new Response(new Uint8Array([1, 2, 3]))
    }
  })
  await context.handle({
    id: 0,
    type: 'load',
    payload: { modelSrc: 'https://example.com/model.gguf' }
  })
  assert.match(context.messages.at(-1).error, /Network disconnected/)
  assert.equal(context.files.size, 0)
  await context.loadModel()
})

test('uses one-token prefill for the Intel correctness workaround', async function () {
  const context = fixture({ adapterVendor: 'intel' })
  await context.loadModel()
  assert.equal(
    context.calls.find((call) => call.name === 'web_load').argument.batchSize,
    1
  )
})

test('retains batched prefill for other adapters', async function () {
  const context = fixture({ adapterVendor: 'amd' })
  await context.loadModel()
  assert.equal(
    context.calls.find((call) => call.name === 'web_load').argument.batchSize,
    128
  )
})

test('decodes split UTF-8 token bytes and emits one ordered terminal result', async function () {
  const steps = [
    { tokenBytes: [0xe2], done: false },
    { tokenBytes: [0x82, 0xac], done: false },
    {
      tokenBytes: [33],
      done: true,
      stopReason: 'eos',
      promptTokens: 4,
      generatedTokens: 3,
      promptMs: 10,
      decodeMs: 20
    }
  ]
  const context = fixture({
    step() {
      return steps.shift()
    }
  })
  const modelId = await context.loadModel()
  await context.handle({
    id: 2,
    type: 'completion',
    payload: {
      modelId,
      requestId: 'run-1',
      history: [{ role: 'user', content: 'Hello' }]
    }
  })
  const frames = context.messages
    .filter(function (message) {
      return message.id === 2 && message.type === 'stream'
    })
    .map(function (message) {
      return message.value
    })
  const events = frames.flatMap(function (frame) {
    return frame.events
  })
  assert.equal(
    events
      .filter(function (event) {
        return event.type === 'contentDelta'
      })
      .map(function (event) {
        return event.text
      })
      .join(''),
    '€!'
  )
  assert.deepEqual(
    events.map(function (event) {
      return event.seq
    }),
    [0, 1, 2, 3]
  )
  assert.equal(
    frames.filter(function (frame) {
      return frame.done
    }).length,
    1
  )
  assert.deepEqual(events.at(-1), {
    type: 'completionDone',
    seq: 3,
    stopReason: 'eos',
    raw: { fullText: '€!' }
  })
  assert.equal(events.at(-2).stats.generatedTokens, 3)
  assert.equal(context.messages.at(-1).type, 'end')
})

test('cancel bypasses an in-flight WASM operation while another mutation is rejected as busy', async function () {
  const reachedStep = deferred()
  const finishStep = deferred()
  let steps = 0
  const context = fixture({
    async step() {
      steps++
      reachedStep.resolve()
      await finishStep.promise
      return { tokenBytes: [65], done: false, generatedTokens: 1 }
    }
  })
  const modelId = await context.loadModel()
  const running = context.handle({
    id: 2,
    type: 'completion',
    payload: { modelId, requestId: 'run-1', history: [] }
  })
  await reachedStep.promise
  await context.handle({ id: 3, type: 'unload', payload: { modelId } })
  assert.match(
    context.messages.find(function (message) {
      return message.id === 3
    }).error,
    /busy/
  )
  await context.handle({
    id: 4,
    type: 'cancel',
    payload: { requestId: 'unrelated' }
  })
  await context.handle({
    id: 5,
    type: 'cancel',
    payload: { requestId: 'run-1' }
  })
  assert.equal(
    context.messages.find(function (message) {
      return message.id === 5
    }).type,
    'result'
  )
  finishStep.resolve()
  await running
  assert.equal(steps, 1)
  const terminal = context.messages.find(function (message) {
    return message.id === 2 && message.value?.done
  })
  assert.equal(terminal.value.events.at(-1).stopReason, 'cancelled')
  await context.handle({ id: 6, type: 'unload', payload: { modelId } })
  assert.equal(context.messages.at(-1).type, 'result')
  assert.equal(context.files.size, 0)
})

test('decode failure settles the request and releases busy ownership for unload', async function () {
  const context = fixture({
    step() {
      return { error: 'GPU dispatch failed' }
    }
  })
  const modelId = await context.loadModel()
  await context.handle({
    id: 2,
    type: 'completion',
    payload: { modelId, requestId: 'run-1', history: [] }
  })
  assert.match(context.messages.at(-1).error, /GPU dispatch failed/)
  assert.equal(context.messages.at(-1).id, 2)
  await context.handle({ id: 3, type: 'unload', payload: { modelId } })
  assert.equal(context.messages.at(-1).type, 'result')
})

test('initialization can retry after a failed attempt', async function () {
  let attempts = 0
  const context = fixture({
    init() {
      attempts++
      return attempts === 1 ? { error: 'No WebGPU adapter' } : {}
    }
  })
  await context.handle({
    id: 0,
    type: 'load',
    payload: { modelSrc: 'https://example.com/model.gguf' }
  })
  assert.match(context.messages.at(-1).error, /No WebGPU adapter/)
  await context.loadModel()
  assert.equal(attempts, 2)
})

test('unknown model ID fails before entering generation', async function () {
  const context = fixture()
  await context.loadModel()
  await context.handle({
    id: 2,
    type: 'completion',
    payload: { modelId: 'wrong-model', requestId: 'run-1' }
  })
  assert.match(context.messages.at(-1).error, /not loaded/)
  assert.equal(
    context.calls.some(function (call) {
      return call.name === 'web_begin'
    }),
    false
  )
})

test('failed model load releases its temporary filesystem allocation', async function () {
  const context = fixture({
    load() {
      return { error: 'Model does not fit GPU memory' }
    }
  })
  await context.handle({
    id: 1,
    type: 'load',
    payload: { modelSrc: 'https://example.com/model.gguf' }
  })
  assert.match(context.messages.at(-1).error, /does not fit/)
  assert.equal(context.files.size, 0)
})
