import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { extract, safe, scrub, wanted } from './download-devicefarm-logs.mjs'

test('only console, logcat and host output artifacts are kept', () => {
  assert.equal(wanted({ name: 'Customer Artifacts', extension: 'zip' }, 'iOS'), true)
  assert.equal(wanted({ name: 'Test spec output', extension: 'txt' }, 'iOS'), true)
  assert.equal(wanted({ name: 'Video', extension: 'mp4' }, 'iOS'), false)
  assert.equal(wanted({ name: 'Logcat', extension: 'mp4' }, 'Android'), false)
  assert.equal(safe('Google Pixel 9 / Pro!'), 'Google_Pixel_9___Pro')
})

test('logs are copied per device, from the run tree and the unpacked zip', () => {
  const root = mkdtempSync(join(tmpdir(), 'df-'))
  const job = join(root, 'logs/Run_Google_Pixel_9')
  const files = {
    'Tests_Suite/Logcat.logcat': 'l',
    'Tests_Suite/Customer_Artifacts.zip': 'z',
    'Tests_Suite/Customer_Artifacts_unpacked/a/bare_console.log': 'b',
    'Tests_Suite/Customer_Artifacts_unpacked/a/test-results.json': '{}',
    'Tests_Suite/Customer_Artifacts_unpacked/crash-reports/QvacAddonTester-1.ips': 'c',
  }
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(join(job, p, '..'), { recursive: true })
    writeFileSync(join(job, p), t)
  }
  extract(join(root, 'logs'), join(root, 'out'))
  assert.deepEqual(readdirSync(join(root, 'out')).sort(), [
    'Run_Google_Pixel_9_Logcat.logcat', 'Run_Google_Pixel_9_bare_console.log', 'Run_Google_Pixel_9_crash_QvacAddonTester-1.ips', 'Run_Google_Pixel_9_test-results.json',
  ])
  assert.equal(existsSync(join(root, 'out/Run_Google_Pixel_9_Customer_Artifacts.zip')), false)
})

test('presigned credentials are redacted before upload', () => {
  const d = mkdtempSync(join(tmpdir(), 'sc-'))
  writeFileSync(join(d, 'a.log'), 'GET https://b.s3/k?X-Amz-Credential=AKIA%2F1&X-Amz-Signature=abc123 "x"')
  writeFileSync(join(d, 'b.log'), 'clean')
  assert.equal(scrub(d), 1)
  assert.equal(readFileSync(join(d, 'a.log'), 'utf8'), 'GET https://b.s3/k?X-Amz-Credential=REDACTED&X-Amz-Signature=REDACTED "x"')
})
