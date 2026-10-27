import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../..', import.meta.url))
const script = path.join(root, 'scripts/sync-zod.mjs')
const snapshot = path.join(root, 'vendor/zod')
test('Zod sync rejects altered upstream bytes and extra runtime files before replacing the snapshot', (t) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-zod-review-'))
  t.after(() => fs.rmSync(source, { recursive: true, force: true }))
  fs.cpSync(snapshot, source, { recursive: true })
  const provenance = fs.readFileSync(path.join(snapshot, 'PROVENANCE.json'), 'utf8')
  const entry = path.join(source, 'index.js')
  const original = fs.readFileSync(entry)
  fs.appendFileSync(entry, '\n// unreviewed runtime change\n')
  let result = spawnSync(process.execPath, [script, source], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /differs from the integrity-pinned upstream archive: index.js/)
  assert.equal(fs.readFileSync(path.join(snapshot, 'PROVENANCE.json'), 'utf8'), provenance)
  fs.writeFileSync(entry, original)
  fs.writeFileSync(path.join(source, 'extra.js'), 'export const unreviewed = true\n')
  result = spawnSync(process.execPath, [script, source], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /file list differs from the integrity-pinned upstream archive/)
  assert.equal(fs.readFileSync(path.join(snapshot, 'PROVENANCE.json'), 'utf8'), provenance)
})
