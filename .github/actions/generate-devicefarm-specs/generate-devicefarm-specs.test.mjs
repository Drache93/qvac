import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generate, render, resolveGroups, shardPerf } from './generate-devicefarm-specs.mjs'

test('groups come from the explicit list, then test-groups.json, then one default spec', () => {
  const d = mkdtempSync(join(tmpdir(), 'tg-'))
  writeFileSync(join(d, 'g.json'), JSON.stringify({ ios: { Smol: ['runA', 'runB'], Perf: ['runC'] }, perf_report_filter: 'x' }))
  assert.deepEqual(resolveGroups('[{"name":"manual","grep":"runA"}]', join(d, 'g.json'), 'iOS'), [{ name: 'manual', grep: 'runA' }])
  assert.deepEqual(resolveGroups('', join(d, 'g.json'), 'iOS'), [{ name: 'Smol', grep: 'runA|runB' }, { name: 'Perf', grep: 'runC' }])
  assert.deepEqual(resolveGroups('', join(d, 'g.json'), 'Android'), [{ name: 'default', grep: '' }])
})

test('a sharded package reports perf only from perf-named shards', () => {
  assert.equal(shardPerf(true, 1, 'default'), true)
  assert.equal(shardPerf(true, 2, 'Smol'), false)
  assert.equal(shardPerf(true, 2, 'GrootPerf'), true)
  assert.equal(shardPerf(false, 1, 'perf'), false)
})

test('a grep cannot break out of the WDIO config', () => {
  assert.equal(render('grep: __MOCHA_GREP__', { __MOCHA_GREP__: JSON.stringify('a"$&b') }), 'grep: "a\\"$&b"')
})

test('one spec per group, with its grep and the default legend', () => {
  const written = []
  const specs = generate({
    platform: 'Android', bundleId: 'io.x', groups: [{ name: 'default', grep: '' }], allTests: ['runA', 'runB'], enablesPerf: true,
    mochaTimeoutMs: '1', waitforMs: '2', outDir: '/o', template: '__BUNDLE_ID__ __ENABLES_PERF__', writeSpec: (f, v) => written.push([f, v]),
  })
  assert.deepEqual(specs, [{ name: 'default', grep: '', tests: 'runA|runB', file: '/o/testspec-default.yml' }])
  assert.equal(Buffer.from(written[0][1].WDIO_CONFIG_B64, 'base64').toString(), 'io.x true')
  assert.equal(written[0][1].HOST_LINE, 'android_test_host: amazon_linux_2')
})
