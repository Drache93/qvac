export async function selectAdapter(gpu) {
  let sawAdapter = false
  for (const powerPreference of ['high-performance', 'low-power']) {
    const adapter = await gpu.requestAdapter({ powerPreference })
    if (!adapter) continue
    sawAdapter = true
    if (adapter.features.has('shader-f16')) return adapter
  }
  throw new Error(
    sawAdapter
      ? 'Available WebGPU adapters do not expose shader-f16, which fabric requires'
      : 'No WebGPU adapter is available'
  )
}
