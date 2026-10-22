import assert from 'node:assert/strict'
import test from 'node:test'
import { originalProbe } from './probe-command.mjs'

const input = {
  bare: '/tools/bare',
  testFile: '/test with spaces.js',
  output: '/results with spaces',
  environment: { PATH: '/tools' }
}
test('sanitizer executes the original Bare test and propagates memory-error failures', () => {
  const r = originalProbe({ ...input, probe: 'memcheck' })
  assert.equal(r.command, 'compute-sanitizer')
  assert.deepEqual(r.args, [
    '--tool',
    'memcheck',
    '--error-exitcode',
    '86',
    input.bare,
    input.testFile,
    '--exit'
  ])
  assert.equal(input.environment.PATH, '/tools')
})
test('graph and fusion probes change one CUDA control at a time', () => {
  const graph = originalProbe({ ...input, probe: 'no-graphs' })
  const fusion = originalProbe({ ...input, probe: 'no-fusion' })
  assert.equal(graph.env.GGML_CUDA_DISABLE_GRAPHS, '1')
  assert.equal(graph.env.GGML_CUDA_DISABLE_FUSION, undefined)
  assert.equal(fusion.env.GGML_CUDA_DISABLE_FUSION, '1')
  assert.equal(fusion.env.GGML_CUDA_DISABLE_GRAPHS, undefined)
  assert.equal(graph.command, input.bare)
})
test('profiler arguments preserve paths and unsupported probes fail closed', () => {
  const r = originalProbe({ ...input, probe: 'nsys' })
  assert.equal(r.args[r.args.indexOf('--output') + 1], '/results with spaces/original-addon-trace')
  assert.throws(() => originalProbe({ ...input, probe: 'unknown' }))
})
