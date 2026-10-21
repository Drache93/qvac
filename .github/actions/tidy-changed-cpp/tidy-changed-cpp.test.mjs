import test from 'node:test'
import assert from 'node:assert/strict'

import { parseBaseCommand, selectFiles } from './tidy-changed-cpp.mjs'

test('only changed sources in the compile database are linted', () => {
  assert.deepEqual(selectFiles(['addon/a.cpp', 'addon/b.hpp', 'test/c.cpp', 'README.md'], ['addon/a.cpp', 'addon/z.cpp']), ['addon/a.cpp'])
})

test('the build dir and header filter come from the helper command', () => {
  assert.deepEqual(parseBaseCommand("clang-tidy -p build/x --quiet --header-filter='^addon/.*'"), { buildDir: 'build/x', headerFilter: '^addon/.*' })
})
