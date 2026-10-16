import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { collect, device, markdown, normalize, parseTap } from './summarize-devicefarm-results.mjs'

test('names merge across devices and runs', () => {
  assert.equal(normalize('CacheTokens (53) > 0'), 'CacheTokens (N) > 0')
  assert.equal(normalize('output matches. Found "abc"'), 'output matches')
  assert.equal(device('Manual-1_Google_Pixel_9_bare_console.log'), 'Google Pixel 9')
  assert.equal(device('random.log'), undefined)
})

test('TAP lines become one result per test', () => {
  const tap = parseTap([
    "I bare    : ok 1 - loads model # time = 1234.5ms'",
    'not ok 2 - runs inference: expected 1',
    'ok 3 - pi05 # SKIP not on mobile',
    'ok 4 - loads model # time = 9ms',
  ].join('\n'))
  assert.deepEqual(Object.fromEntries(tap), {
    'loads model': { status: 'passed', timeMs: 1235 },
    'runs inference': { status: 'failed', timeMs: null },
    pi05: { status: 'skipped', timeMs: null },
  })
})

test('a per-device table is written from results and console logs', () => {
  const d = mkdtempSync(join(tmpdir(), 'sm-'))
  writeFileSync(join(d, 'R_Google_Pixel_9_test-results.json'), JSON.stringify({ tests: [{ title: 'runSmolvla', status: 'passed', duration: 64000 }, { title: 'runPi05', status: 'passed', duration: 3 }] }))
  writeFileSync(join(d, 'R_Google_Pixel_9_bare_console.log'), 'ok 1 - a | b # time = 2000ms')
  const c = collect(d)
  assert.equal(c.runners.runPi05['Google Pixel 9'].status, 'skipped')
  const md = markdown(c, 'pkg — Android')
  assert.match(md, /\| runSmolvla \| ✅ 64s \|/)
  assert.match(md, /\| 1 \| a \\\| b \| ✅ 2s \|/)
})
