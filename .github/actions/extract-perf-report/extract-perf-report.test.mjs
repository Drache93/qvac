import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { extractArgs, reports } from './extract-perf-report.mjs'

test('filter and merge reach the extractor only when set', () => {
  const args = extractArgs({ logDir: 'l', outDir: 'o', runNumber: '5', filter: '', merge: true })
  assert.match(args[0], /scripts\/perf-report\/extract-from-log\.js$/)
  assert.deepEqual(args.slice(1), ['l', 'o/performance-report.json', '--run-number', '5', '--merge'])
})

test('per-device reports get the device in their title', () => {
  const o = mkdtempSync(join(tmpdir(), 'pf-'))
  mkdirSync(join(o, 'Google_Pixel_9'))
  writeFileSync(join(o, 'Google_Pixel_9/performance-report.json'), '{}')
  assert.deepEqual(reports(o, 'Perf (Android)').map((r) => r[1]), ['Perf (Android · Google Pixel 9)'])
  writeFileSync(join(o, 'performance-report.json'), '{}')
  assert.deepEqual(reports(o, 'Perf').map((r) => r[1]), ['Perf'])
})
