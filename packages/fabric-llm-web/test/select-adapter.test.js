import test from 'node:test'
import assert from 'node:assert/strict'
import { selectAdapter } from '../src/select-adapter.js'

test('uses an eligible preferred adapter without requesting another GPU', async function () {
  const preferred = { features: new Set(['shader-f16']) }
  const requests = []
  const adapter = await selectAdapter({
    async requestAdapter(options) {
      requests.push(options.powerPreference)
      return preferred
    }
  })
  assert.equal(adapter, preferred)
  assert.deepEqual(requests, ['high-performance'])
})

test('falls back from an ineligible discrete GPU to an eligible integrated GPU', async function () {
  const integrated = { features: new Set(['shader-f16']) }
  const adapter = await selectAdapter({
    async requestAdapter({ powerPreference }) {
      return powerPreference === 'high-performance'
        ? { features: new Set() }
        : integrated
    }
  })
  assert.equal(adapter, integrated)
})

test('retries when the preferred adapter is unavailable', async function () {
  const integrated = { features: new Set(['shader-f16']) }
  assert.equal(
    await selectAdapter({
      async requestAdapter({ powerPreference }) {
        return powerPreference === 'high-performance' ? null : integrated
      }
    }),
    integrated
  )
})

test('distinguishes unavailable adapters from missing required features', async function () {
  await assert.rejects(
    selectAdapter({
      async requestAdapter() {
        return null
      }
    }),
    /No WebGPU adapter/
  )
  await assert.rejects(
    selectAdapter({
      async requestAdapter() {
        return { features: new Set() }
      }
    }),
    /do not expose shader-f16/
  )
})
