import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { foreignStem, prepare } from './prepare-mobile-prebuilds.mjs'

function pkg(files) {
  const w = join(mkdtempSync(join(tmpdir(), 'mp-')), 'vla-ggml')
  for (const f of files) {
    mkdirSync(join(w, 'prebuilds', f, '..'), { recursive: true })
    writeFileSync(join(w, 'prebuilds', f), '')
  }
  return w
}

test('mobile ABIs are copied from the built one and desktop hosts dropped', () => {
  const w = pkg(['android-arm64/qvac__vla-ggml.bare', 'ios-arm64/qvac__vla-ggml.bare', 'linux-x64/a.bare', 'darwin-arm64/a.bare'])
  assert.deepEqual(prepare({ workdir: w }).sort(), [
    'android-arm', 'android-arm64', 'android-ia32', 'android-x64', 'ios-arm64', 'ios-arm64-simulator', 'ios-x64-simulator',
  ])
})

test('a built simulator slice is kept, not overwritten with the device binary', () => {
  const w = pkg(['ios-arm64/qvac__vla-ggml.bare', 'ios-arm64-simulator/qvac__vla-ggml.bare', 'ios-x64-simulator/qvac__vla-ggml.bare'])
  writeFileSync(join(w, 'prebuilds/ios-arm64/qvac__vla-ggml.bare'), 'device')
  writeFileSync(join(w, 'prebuilds/ios-arm64-simulator/qvac__vla-ggml.bare'), 'simulator-arm64')
  writeFileSync(join(w, 'prebuilds/ios-x64-simulator/qvac__vla-ggml.bare'), 'simulator-x64')
  prepare({ workdir: w })
  assert.equal(readFileSync(join(w, 'prebuilds/ios-arm64-simulator/qvac__vla-ggml.bare'), 'utf8'), 'simulator-arm64')
  assert.equal(readFileSync(join(w, 'prebuilds/ios-x64-simulator/qvac__vla-ggml.bare'), 'utf8'), 'simulator-x64')
})

test('an empty prebuilds/ or a missing expected dir fails', () => {
  assert.throws(() => prepare({ workdir: pkg([]) }), /no prebuilds/)
  assert.throws(() => prepare({ workdir: pkg(['ios-arm64/x.bare']), expectedDirs: ['android-arm64'], source: 'run 1' }), /run 1 has no android-arm64/)
})

test('another addon\'s binary is refused, a split addon\'s slice is accepted', () => {
  assert.equal(foreignStem(['qvac__llm.bare'], 'vla-ggml', 'android-arm64'), 'qvac__llm')
  assert.equal(foreignStem(['qvac__vla-ggml-ios.bare'], 'vla-ggml', 'ios-arm64'), '')
  assert.equal(foreignStem(['libggml.so'], 'vla-ggml', 'android-arm64'), '')
  assert.throws(() => prepare({ workdir: pkg(['android-arm64/qvac__llm.bare']), expectedDirs: ['android-arm64'] }), /not a build of vla-ggml/)
})
