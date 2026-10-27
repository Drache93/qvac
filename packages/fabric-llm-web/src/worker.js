import { createWorkerHost } from './worker-host.js'
import { selectAdapter } from './select-adapter.js'
import createModule from '../dist/wasm-compat/fabric-llm.mjs'

async function probe() {
  if (!self.isSecureContext)
    throw new Error('WebGPU requires HTTPS or localhost')
  if (!self.navigator.gpu)
    throw new Error('This browser does not expose WebGPU to workers')
  const adapter = await selectAdapter(navigator.gpu)
  if (
    adapter.features.has('subgroups') &&
    !navigator.gpu.wgslLanguageFeatures.has('subgroup_id')
  )
    throw new Error(
      'This browser lacks the WGSL num_subgroups builtin used by fabric. Upgrade to Chromium 144 or newer before loading the model.'
    )
  return {
    build: 'compat',
    adapter: {
      vendor: adapter.info?.vendor,
      architecture: adapter.info?.architecture,
      description: adapter.info?.description
    },
    features: [...adapter.features],
    wgslFeatures: [...navigator.gpu.wgslLanguageFeatures],
    maxBufferSize: adapter.limits.maxBufferSize
  }
}

const handle = createWorkerHost({
  post: (message) => self.postMessage(message),
  probe,
  async loadModule(wasmUrl, log) {
    return createModule({
      print: log,
      printErr: log,
      locateFile: (name) =>
        name.endsWith('.wasm') && wasmUrl
          ? new URL(wasmUrl, self.location.href).href
          : new URL('../dist/wasm-compat/fabric-llm.wasm', import.meta.url).href
    })
  }
})
self.addEventListener('message', ({ data }) => {
  void handle(data)
})
