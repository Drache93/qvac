function createQueue() {
  const values = []
  let ended = false
  let failure
  let wake = () => {}
  return {
    push(value) {
      values.push(value)
      wake()
    },
    end() {
      ended = true
      wake()
    },
    fail(error) {
      failure = error
      ended = true
      wake()
    },
    async *iterate() {
      while (true) {
        if (values.length) yield values.shift()
        else if (failure) throw failure
        else if (ended) return
        else
          await new Promise((resolve) => {
            wake = resolve
          })
      }
    }
  }
}

export function createBrowserRuntime(options = {}) {
  const worker =
    options.worker ?? new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
  const pending = new Map()
  let sequence = 0
  let closed = false
  function failAll(error) {
    closed = true
    for (const operation of pending.values()) operation.fail(error)
    pending.clear()
    worker.terminate()
  }
  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'log') {
      options.onLog?.(data.message)
      return
    }
    if (data.type === 'progress') {
      options.onProgress?.(data.progress)
      return
    }
    if (data.type === 'diagnostics') {
      options.onDiagnostics?.(data.diagnostics)
      return
    }
    const operation = pending.get(data.id)
    if (!operation) return
    if (data.type === 'error') {
      operation.fail(new Error(data.error))
      pending.delete(data.id)
    } else if (data.type === 'stream') {
      operation.push(data.value)
    } else if (data.type === 'result') {
      operation.push(data.value)
      operation.end()
      pending.delete(data.id)
    } else if (data.type === 'end') {
      operation.end()
      pending.delete(data.id)
    }
  })
  worker.addEventListener('error', (event) =>
    failAll(new Error(event.message || 'Browser worker failed'))
  )
  worker.addEventListener('messageerror', () =>
    failAll(new Error('Browser worker message could not be read'))
  )
  function start(type, payload) {
    if (closed) throw new Error('Browser runtime is closed')
    const id = ++sequence
    const queue = createQueue()
    pending.set(id, queue)
    try {
      worker.postMessage({ id, type, payload, wasmUrl: options.wasmUrl })
    } catch (error) {
      pending.delete(id)
      queue.fail(error)
    }
    return queue.iterate()
  }
  async function call(type, payload) {
    let value
    for await (const result of start(type, payload)) value = result
    return value
  }
  return {
    loadModel(options) {
      return call('load', options)
    },
    async *streamCompletion(request) {
      let terminal = false
      for await (const frame of start('completion', request)) {
        if (terminal) throw new Error('Browser stream emitted data after its terminal response')
        terminal = frame.done === true
        yield frame
      }
      if (!terminal) throw new Error('Browser stream ended without a terminal response')
    },
    async cancel(options) {
      await call('cancel', options)
    },
    async unloadModel(options) {
      await call('unload', options)
    },
    close() {
      if (!closed) failAll(new Error('Browser runtime closed'))
    }
  }
}
