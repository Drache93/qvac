import test from 'node:test'
import assert from 'node:assert/strict'

import { expectedBackend } from './run-integration.mjs'
import { SMOKE_ENV } from './run-backend.mjs'

test('only the Linux x64 NVIDIA box expects CUDA, unless told otherwise', () => {
  assert.equal(
    expectedBackend({}, 'linux-x64', () => true),
    'cuda'
  )
  assert.equal(
    expectedBackend({}, 'linux-x64', () => false),
    ''
  )
  assert.equal(
    expectedBackend({}, 'win32-x64', () => true),
    ''
  )
  assert.equal(
    expectedBackend({ QVAC_VLA_EXPECTED_BACKEND: 'vulkan' }, 'linux-x64', () => true),
    'vulkan'
  )
})

test('the backend smoke hides CUDA and expects Vulkan', () => {
  assert.deepEqual(SMOKE_ENV, {
    QVAC_VLA_BACKEND_SELECTION_SMOKE: 'true',
    QVAC_VLA_EXPECTED_BACKEND: 'vulkan',
    CUDA_VISIBLE_DEVICES: '-1'
  })
})
