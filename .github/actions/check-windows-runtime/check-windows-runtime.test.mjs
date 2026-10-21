import test from 'node:test'
import assert from 'node:assert/strict'

import { violations } from './check-windows-runtime.mjs'

test('a dynamic CRT import is reported, system DLLs are not', () => {
  const deps = '  Image has the following dependencies:\n    KERNEL32.dll\n    VCRUNTIME140.dll\n    api-ms-win-crt-runtime-l1-1-0.dll\n    vulkan-1.dll\n'
  assert.deepEqual(violations('a.bare', deps), ['a.bare -> VCRUNTIME140.dll', 'a.bare -> api-ms-win-crt-runtime-l1-1-0.dll'])
  assert.deepEqual(violations('b.dll', '    KERNEL32.dll\n    ADVAPI32.dll\n'), [])
})
