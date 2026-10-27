import { downloadModelToCache } from './model-download.js'

const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0))

export function createWorkerHost({
  post,
  loadModule,
  probe,
  fetchModel = fetch,
  storage = globalThis.navigator?.storage
}) {
  let modulePromise
  let module
  let capabilities
  let modelId
  let active
  let busy = false
  let loadedPath
  function send(id, type, value) {
    post({ id, type, value })
  }
  async function invoke(name, argument) {
    const status = await module.ccall(
      name,
      'number',
      argument === undefined ? [] : ['string'],
      argument === undefined ? [] : [JSON.stringify(argument)],
      { async: true }
    )
    const result = JSON.parse(module.ccall('web_result', 'string', [], []))
    if (status !== 0) throw new Error(result.error || `${name} failed`)
    return result
  }
  async function initialize(wasmUrl) {
    if (!modulePromise)
      modulePromise = (async () => {
        capabilities = await probe()
        module = await loadModule(wasmUrl, (line) =>
          post({ type: 'log', message: String(line) })
        )
        if (!module.FS.filesystems.WORKERFS)
          throw new Error(
            'This WASM artifact must be rebuilt with WORKERFS support'
          )
        module.FS.mkdir('/models')
        const engine = await invoke('web_init')
        post({
          type: 'diagnostics',
          diagnostics: { ...capabilities, ...engine }
        })
        return module
      })().catch((error) => {
        modulePromise = undefined
        throw error
      })
    return modulePromise
  }
  function mountModel(file) {
    module.FS.mount(
      module.FS.filesystems.WORKERFS,
      { blobs: [{ name: 'model.gguf', data: file }] },
      '/models'
    )
    return '/models/model.gguf'
  }
  async function downloadDirect(url) {
    const source = new URL(url)
    if (!['http:', 'https:'].includes(source.protocol))
      throw new Error('Model URL must use HTTP or HTTPS')
    const response = await fetchModel(source.href)
    if (!response.ok)
      throw new Error(`Model download failed: HTTP ${response.status}`)
    const total = Number(response.headers.get('content-length')) || 0
    let downloaded = 0
    const progress = new TransformStream({
      transform(chunk, controller) {
        downloaded += chunk.length
        post({
          type: 'progress',
          progress: {
            downloaded,
            total,
            percentage: total ? (100 * downloaded) / total : 0
          }
        })
        controller.enqueue(chunk)
      }
    })
    return new Response(response.body.pipeThrough(progress)).blob()
  }
  async function download(url) {
    const cached = await downloadModelToCache({
      url,
      fetchModel,
      storage,
      onProgress(progress) {
        post({ type: 'progress', progress })
      },
      onLog(message) {
        post({ type: 'log', message })
      }
    })
    return cached ?? downloadDirect(url)
  }
  function assertModel(id) {
    if (!modelId || id !== modelId)
      throw new Error('Model is not loaded in this runtime')
  }
  async function completion(id, request) {
    assertModel(request.modelId)
    const state = { requestId: request.requestId, cancelled: false }
    active = state
    let seq = 0
    let raw = ''
    const decoder = new TextDecoder()
    let firstTokenMs
    const start = performance.now()
    const emit = (events) =>
      send(id, 'stream', { type: 'completionStream', events })
    try {
      await invoke('web_begin', {
        messages: request.history,
        temperature: request.generationParams?.temp ?? 0,
        seed: request.generationParams?.seed ?? 42,
        maxTokens: request.generationParams?.predict ?? 128
      })
      let step = {}
      while (!state.cancelled) {
        step = await invoke('web_step')
        if (step.tokenBytes?.length) {
          const text = decoder.decode(new Uint8Array(step.tokenBytes), {
            stream: true
          })
          firstTokenMs ??= performance.now() - start
          if (text) {
            raw += text
            emit([{ type: 'contentDelta', seq: seq++, text }])
          }
        }
        if (step.done) break
        await yieldTask()
      }
      const tail = decoder.decode()
      if (tail) {
        raw += tail
        emit([{ type: 'contentDelta', seq: seq++, text: tail }])
      }
      const stats = {
        promptTokens: step.promptTokens ?? 0,
        generatedTokens: step.generatedTokens ?? 0,
        timeToFirstToken: firstTokenMs,
        promptTokensPerSecond:
          step.promptMs > 0
            ? (1000 * step.promptTokens) / step.promptMs
            : undefined,
        tokensPerSecond:
          step.decodeMs > 0
            ? (1000 * step.generatedTokens) / step.decodeMs
            : undefined,
        backendDevice: 'gpu'
      }
      const stopReason = state.cancelled
        ? 'cancelled'
        : step.stopReason === 'eos'
          ? 'eos'
          : 'length'
      send(id, 'stream', {
        type: 'completionStream',
        done: true,
        events: [
          { type: 'completionStats', seq: seq++, stats },
          {
            type: 'completionDone',
            seq: seq++,
            stopReason,
            raw: { fullText: raw }
          }
        ]
      })
    } finally {
      active = undefined
    }
  }
  return async function handle({ id, type, payload, wasmUrl }) {
    // Control messages bypass the generation operation's ownership.
    if (type === 'cancel') {
      if (
        active &&
        ((!payload.requestId && payload.modelId === modelId) ||
          payload.requestId === active.requestId)
      )
        active.cancelled = true
      send(id, 'result', null)
      return
    }
    if (busy) {
      post({
        id,
        type: 'error',
        error: 'Browser runtime is busy; one operation is supported at a time'
      })
      return
    }
    busy = true
    try {
      await initialize(wasmUrl)
      if (type === 'load') {
        if (modelId)
          throw new Error('Unload the current model before loading another')
        loadedPath = mountModel(await download(payload.modelSrc))
        const loaded = await invoke('web_load', {
          modelPath: loadedPath,
          contextSize: payload.ctxSize ?? 2048,
          // Batched prefill produced incorrect output on the tested Intel WebGPU path.
          batchSize: capabilities.adapter?.vendor === 'intel' ? 1 : 128
        })
        post({
          type: 'diagnostics',
          diagnostics: {
            ...loaded,
            modelFilesystem: 'workerfs',
            wasmHeapBytes: module.HEAPU8?.byteLength
          }
        })
        modelId = crypto.randomUUID()
        send(id, 'result', modelId)
      } else if (type === 'unload') {
        assertModel(payload.modelId)
        await invoke('web_unload')
        modelId = undefined
        if (loadedPath) module.FS.unmount('/models')
        loadedPath = undefined
        send(id, 'result', null)
      } else if (type === 'completion') {
        await completion(id, payload)
        send(id, 'end')
      } else throw new Error(`Unsupported browser operation: ${type}`)
    } catch (error) {
      if (type === 'load' && !modelId && loadedPath) {
        try {
          module.FS.unmount('/models')
        } catch {
          /* Preserve the original load error if mount cleanup also fails. */
        }
        loadedPath = undefined
      }
      post({ id, type: 'error', error: error.message || String(error) })
    } finally {
      busy = false
    }
  }
}
