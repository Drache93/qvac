import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { plan, readPlans } from '../plan-pr-build.mjs'

const vla = { name: '@qvac/vla-ggml', dir: 'packages/vla-ggml', waits: [] }
const build = [{ dir: 'packages/vla-ggml', platform: 'linux' }, { dir: 'packages/vla-ggml', platform: 'win32' }]

test('a reused package builds nothing and takes its prebuilds from the earlier run', () => {
  const p = plan({ projects: [vla], build, plans: { 'packages/vla-ggml': { dir: 'packages/vla-ggml', hit: true, runId: '41', hash: 'h' } }, runId: '99' })
  assert.deepEqual(p.build, [])
  assert.deepEqual([p.reused['packages/vla-ggml'], p.sources['packages/vla-ggml'], p.hashes['packages/vla-ggml']], [true, '41', 'h'])
})

test('a miss builds every leg here', () => {
  const p = plan({ projects: [vla], build, plans: {}, runId: '99' })
  assert.equal(p.build.length, 2)
  assert.equal(p.sources['packages/vla-ggml'], '99')
})

test('dependency waits are deduplicated, and more than one per package is refused', () => {
  const fab = { key: 'fabric', artifact: 'fabric-prebuilds' }
  const p = plan({ projects: [{ ...vla, waits: [fab] }, { name: 'b', dir: 'packages/b', waits: [fab] }], build: [], plans: {}, runId: '1' })
  assert.deepEqual(p.waits, [fab])
  assert.throws(() => plan({ projects: [{ ...vla, waits: [fab, { key: 'x' }] }], build: [], plans: {}, runId: '1' }), /overlays one/)
})

test('reuse results are read from the downloaded plan files', () => {
  const d = mkdtempSync(join(tmpdir(), 'plans-'))
  mkdirSync(join(d, 'plan-vla-ggml'))
  writeFileSync(join(d, 'plan-vla-ggml/plan.json'), JSON.stringify({ dir: 'packages/vla-ggml', hit: false }))
  assert.deepEqual(readPlans(d), { 'packages/vla-ggml': { dir: 'packages/vla-ggml', hit: false } })
  assert.deepEqual(readPlans(''), {})
})
