import test from 'node:test'
import assert from 'node:assert/strict'

import { modelEnv } from './model-env.mjs'

const manifest = { models: { a: { dest: 'model/a.gguf', skip: ['darwin-x64'] } } }

test('a variable points at the manifest destination', () => {
  assert.deepEqual(modelEnv({ A: 'a' }, { env: {}, pkg: '/p', host: 'linux-x64', manifest }), {
    A: '/p/model/a.gguf'
  })
})

test('a skipped host leaves it unset, and a caller value wins', () => {
  assert.deepEqual(modelEnv({ A: 'a' }, { env: {}, pkg: '/p', host: 'darwin-x64', manifest }), {})
  assert.deepEqual(
    modelEnv({ A: 'a' }, { env: { A: '/mine' }, pkg: '/p', host: 'linux-x64', manifest }),
    { A: '/mine' }
  )
})

test('every model the scripts name is in the real manifest', () => {
  assert.doesNotThrow(() =>
    modelEnv(
      {
        S: 'smolvla-libero-vision-q8.gguf',
        P: 'pi05-base-q-aggressive.gguf',
        F: 'pi05-fixture.safetensors',
        A: 'pi05-activations.safetensors',
        G: 'groot-multi-q8_vf16.gguf',
        W: 'groot-multi-activations_sweep.safetensors',
        L: 'groot-libero-q8_vf16.gguf',
        V: 'groot-libero-activations_v4.safetensors'
      },
      { env: {} }
    )
  )
})
