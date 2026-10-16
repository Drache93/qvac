import test from 'node:test'
import assert from 'node:assert/strict'

import { check } from './run-cpp-tests.mjs'

const xml = '<testsuite><testcase name="a"/><testcase name="b"/></testsuite>'

test('a full run with GR00T staged passes', () => {
  const log = '[ RUN      ] GrootM4_2\n[GrootEmbodimentSweep] row 0 ok\n'
  const r = check({ log, xml, env: { GROOT_TEST_GGUF: 'x', GROOT_TEST_SWEEP_GGUF: 'y' } })
  assert.deepEqual([r.count, r.sweep.length, r.errors], [2, 1, []])
})

test('no tests, skipped GR00T tests, or an empty sweep fail', () => {
  assert.match(check({ log: '', xml: '', env: {} }).errors[0], /no tests/)
  const skipped = check({
    log: '[  SKIPPED ] GrootM4_2 (0 ms)',
    xml,
    env: { GROOT_TEST_GGUF: 'x' }
  })
  assert.match(skipped.errors[0], /were skipped:\n\[ {2}SKIPPED \] GrootM4_2/)
  assert.match(check({ log: '', xml, env: { GROOT_TEST_SWEEP_GGUF: 'y' } }).errors[0], /no rows/)
})

test('skips are fine where GR00T is not staged', () => {
  assert.deepEqual(check({ log: '[  SKIPPED ] GrootM4_2', xml, env: {} }).errors, [])
})
