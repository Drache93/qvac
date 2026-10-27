const os = require('os')

// lazy: the addon drags the graphics stack (and on Linux a second LLVM) into its importer
let GPUInfo

// system RAM is here to catch integrated-GPU lies
exports.readSystemStats = function readSystemStats() {
  try {
    GPUInfo ??= require('bare-gpu-info')
    const info = new GPUInfo()
    try {
      const devices = [...info]
        .filter((gpu) => typeof gpu.memory === 'number' && gpu.name)
        .map((gpu) => ({ name: gpu.name, videoMemoryBytes: gpu.memory }))
      if (devices.length === 0) {
        return null
      }

      return { memory: { totalBytes: os.totalmem() }, gpu: { devices } }
    } finally {
      info.destroy()
    }
  } catch {
    return null
  }
}
