import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { download } from './download-models.mjs'

const sha = (t) => createHash('sha256').update(t).digest('hex')

test('only missing models for the target are fetched', async () => {
  const w = mkdtempSync(join(tmpdir(), 'models-'))
  mkdirSync(join(w, 'model'), { recursive: true })
  writeFileSync(join(w, 'model/have.gguf'), 'x')
  const fetched = []
  const manifest = {
    source: 's3',
    models: {
      have: { s3Path: 'p/have', dest: 'model/have.gguf' },
      need: { s3Path: 'p/need', dest: 'model/need.gguf', targets: ['cpp:tests'] },
      other: { s3Path: 'p/other', dest: 'model/other.gguf', targets: ['test:integration'] },
    },
  }
  const n = await download({ manifest, workdir: w, target: 'cpp:tests', fetchObject: (k, f) => (fetched.push(k), writeFileSync(f, 'y')) })
  assert.equal(n, 1)
  assert.deepEqual(fetched, ['p/need'])
})

test('a stale pinned file is fetched again, and a bad download fails', async () => {
  const w = mkdtempSync(join(tmpdir(), 'models-'))
  writeFileSync(join(w, 'm.gguf'), 'stale')
  const manifest = { source: 's3', models: { m: { s3Path: 'p/m', dest: 'm.gguf', sha256: sha('good'), bytes: 4 } } }
  assert.equal(await download({ manifest, workdir: w, fetchObject: (k, f) => writeFileSync(f, 'good') }), 1)
  writeFileSync(join(w, 'm.gguf'), 'stale')
  await assert.rejects(download({ manifest, workdir: w, fetchObject: (k, f) => writeFileSync(f, 'evil') }), /does not match/)
})

test('a non-S3 manifest is refused', async () => {
  await assert.rejects(download({ manifest: { source: 'hf', models: {} }, workdir: '.', fetchObject: () => {} }), /"s3" only/)
})

test('a host an entry skips does not fetch it', async () => {
  const w = mkdtempSync(join(tmpdir(), 'models-'))
  const manifest = { source: 's3', models: { m: { s3Path: 'p/m', dest: 'm.gguf', skip: ['darwin-x64'] } } }
  const fetch = (k, f) => writeFileSync(f, 'y')
  assert.equal(await download({ manifest, workdir: w, host: 'darwin-x64', fetchObject: fetch }), 0)
  assert.equal(await download({ manifest, workdir: w, host: 'darwin-arm64', fetchObject: fetch }), 1)
})
