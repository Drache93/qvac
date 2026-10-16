import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { distTag, gprName, linkBareAliases, publishVersion } from './publish-gpr.mjs'

test('a release branch push or dispatch publishes latest, anything else the given tag or tmp', () => {
  assert.equal(distTag({ tag: 'dev', event: 'push', refName: 'release-vla-0.4' }), 'latest')
  assert.equal(distTag({ tag: 'dev', event: 'workflow_dispatch', refName: 'main' }), 'dev')
  assert.equal(distTag({ tag: '', event: 'push', refName: 'tmp-x' }), 'tmp')
})

test('only latest keeps the package version', () => {
  assert.equal(publishVersion({ version: '0.4.0', tag: 'latest', runId: '9' }), '0.4.0')
  assert.equal(publishVersion({ version: '0.4.0', tag: 'dev', runId: '9' }), '0.4.0-tmp.runid-9')
  assert.equal(publishVersion({ version: '0.4.0', tag: 'tmp', pr: 12, runId: '9' }), '0.4.0-tmp.pr-12.runid-9')
})

test('the name moves to @tetherto with the suffix on the name part', () => {
  assert.equal(gprName('@qvac/vla-ggml', '-mono'), '@tetherto/vla-ggml-mono')
  assert.equal(gprName('@tetherto/x', ''), '@tetherto/x')
})

test('built .bare modules stay reachable under the new name', () => {
  const d = mkdtempSync(join(tmpdir(), 'gpr-'))
  mkdirSync(join(d, 'prebuilds/linux-x64'), { recursive: true })
  mkdirSync(join(d, 'prebuilds/android-arm64'), { recursive: true })
  writeFileSync(join(d, 'prebuilds/linux-x64/qvac__vla-ggml.bare'), '')
  writeFileSync(join(d, 'prebuilds/linux-x64/qvac__vla-ggml.bare.exports'), '')
  assert.equal(linkBareAliases(d, '@qvac/vla-ggml', '@tetherto/vla-ggml-mono'), 2)
  assert.equal(readlinkSync(join(d, 'prebuilds/linux-x64/tetherto__vla-ggml-mono.bare')), 'qvac__vla-ggml.bare')
  assert.equal(linkBareAliases(d, '@tetherto/a', '@tetherto/a'), 0)
})
