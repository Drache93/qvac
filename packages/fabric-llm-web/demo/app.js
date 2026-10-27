const elements = Object.fromEntries(
  [...document.querySelectorAll('[id]')].map(function (element) {
    return [element.id, element]
  })
)
const defaultModelUrl =
  'https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/resolve/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf'
elements['model-url'].value =
  new URLSearchParams(location.search).get('model') ?? defaultModelUrl
const evidence = {
  browser: navigator.userAgent,
  origin: location.origin,
  startedAt: new Date().toISOString(),
  logs: [],
  diagnostics: [],
  runs: []
}
let client
let runtime
let InferenceCancelledError
let modelId
let activeRun
let busy = false
let closed = false
let webgpuReady = false
let history = []

function log(value) {
  const message = typeof value === 'string' ? value : JSON.stringify(value)
  evidence.logs.push({ at: new Date().toISOString(), message })
  elements.logs.textContent = evidence.logs
    .slice(-250)
    .map(function (entry) {
      return `${entry.at.slice(11, 23)} ${entry.message}`
    })
    .join('\n')
  elements.logs.scrollTop = elements.logs.scrollHeight
}

function setStatus(text, state = 'idle') {
  elements.status.textContent = text
  elements.status.dataset.state = state
}

function updateControls() {
  elements.load.disabled =
    busy || Boolean(modelId) || closed || !client || !webgpuReady
  elements.run.disabled = busy || !modelId || closed
  elements.stop.disabled = !activeRun
  elements.unload.disabled = busy || !modelId || closed
  elements['model-url'].disabled = busy || Boolean(modelId)
  elements.context.disabled = busy || Boolean(modelId)
  elements.clear.disabled = busy
  elements.close.disabled = closed || !client
  elements['history-info'].textContent = history.length
    ? `${history.length / 2} completed turn(s) in history`
    : 'Fresh conversation'
}

function setWebGpuReadiness(ready, detail) {
  webgpuReady = ready
  elements['webgpu-readiness'].dataset.state = ready
    ? 'available'
    : 'unavailable'
  elements['webgpu-readiness-label'].textContent = ready
    ? 'WebGPU ready'
    : 'WebGPU unavailable'
  elements['webgpu-readiness'].title = detail
  elements['webgpu-help'].hidden = ready
  updateControls()
}

function reportError(error) {
  elements.error.textContent =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  elements.error.hidden = false
  log(elements.error.textContent)
  setStatus('Failed', 'error')
}

function resetError() {
  elements.error.hidden = true
  elements.error.textContent = ''
}

function showProgress(progress) {
  const loaded = progress.downloaded ?? 0
  const total = progress.total ?? progress.totalBytes ?? 0
  elements.progress.hidden = false
  const phase = progress.cacheHit
    ? 'Using cached model'
    : progress.resumed
      ? 'Resuming download'
      : 'Downloading model'
  if (total > 0) {
    elements.progress.value = loaded / total
    elements['progress-text'].textContent =
      `${phase} · ${(loaded / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB · ${((100 * loaded) / total).toFixed(0)}%`
  } else {
    elements.progress.removeAttribute('value')
    elements['progress-text'].textContent = loaded
      ? `${phase} · ${(loaded / 1e6).toFixed(0)} MB`
      : 'Initializing model…'
  }
}

function showStats(stats, final) {
  elements.stats.replaceChildren()
  for (const [key, value] of Object.entries({
    ...stats,
    stopReason: final?.stopReason
  })) {
    if (value === undefined || value === null) continue
    const item = document.createElement('div')
    const label = document.createElement('dt')
    const content = document.createElement('dd')
    label.textContent = key
    content.textContent =
      typeof value === 'number'
        ? String(Number(value.toFixed(2)))
        : String(value)
    item.append(label, content)
    elements.stats.append(item)
  }
}

elements.load.addEventListener('click', async function () {
  resetError()
  busy = true
  updateControls()
  setStatus('Loading model', 'busy')
  elements['progress-text'].textContent = 'Fetching model and preparing WebGPU…'
  const modelSrc = elements['model-url'].value.trim()
  evidence.model = { modelSrc, ctxSize: Number(elements.context.value) }
  try {
    modelId = await client.loadModel(evidence.model)
    history = []
    log({ loadedModel: modelId })
    elements.output.textContent = 'Model loaded. Send a prompt.'
    elements['progress-text'].textContent = 'Model ready.'
    setStatus('Ready', 'ready')
  } catch (error) {
    reportError(error)
  } finally {
    busy = false
    elements.progress.hidden = true
    updateControls()
  }
})

elements.run.addEventListener('click', async function () {
  resetError()
  const prompt = elements.prompt.value.trim()
  if (!prompt) return
  busy = true
  elements.output.textContent = ''
  elements.stats.replaceChildren()
  const started = performance.now()
  let firstTokenMs
  let timer
  const events = []
  const requestHistory = [...history, { role: 'user', content: prompt }]
  try {
    activeRun = client.completion({
      modelId,
      history: requestHistory,
      stream: true,
      generationParams: {
        predict: Number(elements.tokens.value),
        temp: 0.6,
        seed: 42
      }
    })
    updateControls()
    setStatus('Generating', 'busy')
    timer = setInterval(function () {
      elements.elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`
    }, 100)
    for await (const event of activeRun.events) {
      events.push(event)
      if (event.type === 'contentDelta') {
        firstTokenMs ??= performance.now() - started
        elements.output.textContent += event.text
      }
      if (event.type === 'completionStats') showStats(event.stats)
    }
    const final = await activeRun.final
    elements.output.textContent = final.raw?.fullText ?? final.contentText
    history = [
      ...requestHistory,
      { role: 'assistant', content: final.raw?.fullText ?? final.contentText }
    ]
    showStats(final.stats, final)
    evidence.runs.push({
      requestId: activeRun.requestId,
      history: requestHistory,
      events,
      final,
      wallMs: performance.now() - started,
      firstTokenMs
    })
    log({
      requestId: activeRun.requestId,
      stopReason: final.stopReason,
      stats: final.stats
    })
    setStatus('Ready', 'ready')
  } catch (error) {
    evidence.runs.push({
      requestId: activeRun?.requestId,
      history: requestHistory,
      events,
      error: String(error),
      wallMs: performance.now() - started,
      firstTokenMs
    })
    if (InferenceCancelledError && error instanceof InferenceCancelledError) {
      log({ cancelled: activeRun?.requestId, partial: error.partial })
      setStatus('Stopped', 'ready')
    } else reportError(error)
  } finally {
    clearInterval(timer)
    elements.elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`
    activeRun = undefined
    busy = false
    updateControls()
  }
})

elements.stop.addEventListener('click', async function () {
  if (!activeRun) return
  elements.stop.disabled = true
  const requestedAt = performance.now()
  try {
    const result = await client.cancel({ requestId: activeRun.requestId })
    log({
      cancellationResponse: result,
      responseMs: performance.now() - requestedAt
    })
  } catch (error) {
    reportError(error)
  }
})

elements.unload.addEventListener('click', async function () {
  resetError()
  busy = true
  updateControls()
  try {
    await client.unloadModel({ modelId })
    modelId = undefined
    history = []
    setStatus('Not loaded')
    log('Model unloaded')
  } catch (error) {
    reportError(error)
  } finally {
    busy = false
    updateControls()
  }
})

elements.clear.addEventListener('click', function () {
  history = []
  updateControls()
})
elements.close.addEventListener('click', async function () {
  closed = true
  updateControls()
  try {
    await client.close()
    log('Runtime closed')
    setStatus('Closed')
  } catch (error) {
    reportError(error)
  }
})
elements['download-logs'].addEventListener('click', function () {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `qvac-webgpu-${new Date().toISOString().replaceAll(':', '-')}.json`
  link.click()
  setTimeout(function () {
    URL.revokeObjectURL(url)
  }, 1000)
})
elements['webgpu-help'].addEventListener('click', function () {
  elements['webgpu-dialog'].showModal()
})
elements['copy-flags-url'].addEventListener('click', async function () {
  const button = elements['copy-flags-url']
  try {
    await navigator.clipboard.writeText(elements['chrome-flags-url'].value)
    button.textContent = 'Copied'
  } catch {
    elements['chrome-flags-url'].select()
    button.textContent = 'Press Ctrl+C'
  }
  setTimeout(function () {
    button.textContent = 'Copy address'
  }, 1500)
})

async function checkWebGpuReadiness() {
  if (!navigator.gpu) {
    const detail = 'This browser does not expose the WebGPU API.'
    setWebGpuReadiness(false, detail)
    return { ready: false, detail }
  }
  const { selectAdapter } = await import('../src/select-adapter.js')
  try {
    const adapter = await selectAdapter(navigator.gpu)
    const detail = 'A WebGPU adapter with shader-f16 is available.'
    setWebGpuReadiness(true, detail)
    return {
      ready: true,
      detail,
      features: [...adapter.features].sort()
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    setWebGpuReadiness(false, detail)
    return { ready: false, detail }
  }
}

async function initialize() {
  updateControls()
  const capabilities = {
    secureContext: isSecureContext,
    webgpu: Boolean(navigator.gpu),
    jspi: typeof WebAssembly.Suspending === 'function',
    crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
  }
  const webgpuReadiness = await checkWebGpuReadiness()
  evidence.capabilities = capabilities
  evidence.webgpuReadiness = webgpuReadiness
  elements.capabilities.textContent = Object.entries(capabilities)
    .map(function ([key, value]) {
      return `${key}: ${value}`
    })
    .join('\n')
  elements.capabilities.textContent += `\nfabricWebGpu: ${webgpuReadiness.ready}`
  const [{ createBrowserRuntime }, sdk] = await Promise.all([
    import('../src/client.js'),
    import('../dist/sdk-browser.js')
  ])
  InferenceCancelledError = sdk.InferenceCancelledError
  const workerUrl = new URL('../src/worker.js', import.meta.url)
  runtime = createBrowserRuntime({
    worker: new Worker(workerUrl, { type: 'module' }),
    onLog: log,
    onProgress: showProgress,
    onDiagnostics: function (value) {
      evidence.diagnostics.push(value)
      elements.diagnostics.textContent = JSON.stringify(value, null, 2)
      log({ diagnostics: value })
    }
  })
  client = sdk.createBrowserClient(runtime)
  log('Browser SDK client created')
  updateControls()
}

window.addEventListener('pagehide', function () {
  if (runtime) void runtime.close()
})
initialize().catch(reportError)
