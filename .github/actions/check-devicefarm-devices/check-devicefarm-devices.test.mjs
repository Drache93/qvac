import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { check, parseModels, runnerSource } from './check-devicefarm-devices.mjs'

const fleet = ['Google Pixel 9', 'Google Pixel 9 Pro', 'Samsung Galaxy S25 Ultra']
const one = { runners: ['runSmolvla', 'runGroot'], specs: 2 }

test('the device list is trimmed and deduplicated', () => {
  assert.deepEqual(parseModels(' Google Pixel 9, ,Google Pixel 9,Samsung Galaxy S25 Ultra'), ['Google Pixel 9', 'Samsung Galaxy S25 Ultra'])
})

test('runner names come from test-groups.json, else integration.auto.cjs', () => {
  const d = mkdtempSync(join(tmpdir(), 'dv-'))
  writeFileSync(join(d, 'g.json'), JSON.stringify({ android: { A: ['runA', 'runB'], B: ['runB'] }, perf_report_filter: 'x' }))
  writeFileSync(join(d, 'auto.cjs'), 'async function runOne () {}\nasync function runTwo () {}')
  assert.deepEqual(runnerSource(join(d, 'g.json'), '', 'Android'), { runners: ['runA', 'runB'], specs: 2 })
  assert.deepEqual(runnerSource('', join(d, 'auto.cjs'), 'iOS'), { runners: ['runOne', 'runTwo'], specs: 1 })
})

test('existing devices pass and the run count is specs x devices', () => {
  assert.equal(check({ models: ['Google Pixel 9 Pro'], operator: 'EQUALS', tests: '', source: one, fleet }), 2)
  assert.equal(check({ models: ['Google Pixel 9 Pro'], operator: 'EQUALS', tests: 'runGroot', source: one, fleet }), 1)
})

test('bad selections fail before any build', () => {
  const c = (o) => () => check({ models: ['Google Pixel 9 Pro'], operator: 'EQUALS', tests: '', source: one, fleet, ...o })
  assert.throws(c({ models: [] }), /no device/)
  assert.throws(c({ operator: 'LIKE' }), /EQUALS or CONTAINS/)
  assert.throws(c({ models: ['Pixel 10'] }), /no EQUALS match .*Pixel 10/)
  assert.throws(c({ tests: '^runGroot' }), /may hold only/)
  assert.throws(c({ tests: 'runTypo' }), /matches none of: runSmolvla, runGroot/)
  assert.throws(c({ models: ['Pixel 9', 'Pixel 9 Pro'], operator: 'CONTAINS' }), /overlap on Google Pixel 9 Pro/)
  assert.throws(c({ source: { runners: [], specs: 21 }, models: ['Google Pixel 9', 'Samsung Galaxy S25 Ultra'] }), /exceeds 40/)
})
