import test from 'node:test'
import assert from 'node:assert/strict'

import { resolve } from './resolve-model-cache.mjs'

const manifest = JSON.stringify({
  source: 's3',
  models: {
    a: { s3Path: 'p/a', dest: 'model/vla/a.gguf', targets: ['test:integration', 'cpp:tests'] },
    b: { s3Path: 'p/b', dest: 'test/oracle/b.safetensors', targets: ['cpp:tests'] },
    c: { s3Path: 'p/c', dest: 'model/vla/c.gguf' },
  },
})

test('a target gets only its models and its own key', () => {
  const r = resolve({ manifestText: manifest, workdir: 'packages/x', target: 'test:integration' })
  assert.deepEqual(r.paths, ['packages/x/model/vla'])
  assert.equal(r.count, 2)
  assert.match(r.key, /^models-x-test-integration-v1-[0-9a-f]{16}$/)
  assert.equal(resolve({ manifestText: manifest, workdir: 'packages/x', target: 'cpp:tests' }).paths.length, 2)
})

test('the key moves with the manifest and nothing else', () => {
  const k = (text, v) => resolve({ manifestText: text, workdir: 'packages/x', target: 'cpp:tests', version: v }).key
  assert.equal(k(manifest), k(manifest))
  assert.notEqual(k(manifest), k(manifest.replace('p/b', 'p/b2')))
  assert.notEqual(k(manifest), k(manifest, 'v2'))
})
