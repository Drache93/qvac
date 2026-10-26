# System resource diagnostics

Use `getSystemResources` to inspect locally observed CPU, system-memory, GPU, and
driver capabilities. Pass `sample: true` only when you also need a fresh usage
sample:

```ts
import { getSystemResources } from '@qvac/sdk'

const resources = await getSystemResources({ sample: true })

if (resources.capabilities.memory.totalBytes.status === 'supported') {
  console.log('System memory:', resources.capabilities.memory.totalBytes.value)
}

if (resources.sample?.cpu.status === 'supported') {
  console.log('CPU utilization:', resources.sample.cpu.value)
}
```

See the [system resources support matrix](./system-resources-support-matrix.md)
for metric-level evidence and platform limitations.

Every metric reports `supported`, `unavailable`, `unverified`, or `failed`.
Supported values include provenance with a source and optional scope. These
values are diagnostics; they do not reserve memory or guarantee that a model
can be loaded.

GPU capabilities expose observed driver names, versions, and graphics APIs.
These observations do not prove that an inference backend is compatible.

Profiled inference operation events may include `event.backend` with the
selected backend and device, graphics API, driver, fallback reason, and probe
result. Addons attach backend metadata with `attachBackendDiagnostics`; the SDK
validates it before recording the operation event. `gpuId`, when present,
identifies a GPU from the current worker resource collector and is stable only
for that collector's lifetime. The SDK does not infer compatibility from driver
inventory or log text.

## Profiler resource gauges

Resource gauges are disabled by default. Enable them explicitly to attach one
worker resource sample to each profiled operation:

```ts
import { profiler } from '@qvac/sdk'

profiler.enable({ mode: 'verbose', includeResourceGauges: true })

// Run SDK operations, then inspect recentEvents[].resources.
const profile = profiler.exportJSON()
```

The sample uses the same status, provenance, and scope semantics as
`getSystemResources({ sample: true })`. Its `sampledAt` uses the same monotonic
clock as the profiling event's `ts`, so the two timestamps are comparable.
`resources.origin` records that the sample was taken on the `local` worker.
Samples are delivered to `profiler.onRecord`; they
are retained in `exportJSON().recentEvents` only in `verbose` mode. Enabling
gauges in `summary` mode still incurs the sampling cost without retaining them.
Disabling profiling or omitting `includeResourceGauges` performs no resource
sampling. Enabling gauges adds one CPU query and one query per GPU to each
profiled operation's response path. If the worker resource collector is not
initialized, the event omits the resource block.
