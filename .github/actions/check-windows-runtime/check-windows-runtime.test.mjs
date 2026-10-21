import test from 'node:test'
import assert from 'node:assert/strict'

import { pickDumpbin, violations } from './check-windows-runtime.mjs'

test('a dynamic CRT import is reported, system DLLs are not', () => {
  const deps = '  Image has the following dependencies:\n    KERNEL32.dll\n    VCRUNTIME140.dll\n    api-ms-win-crt-runtime-l1-1-0.dll\n    vulkan-1.dll\n'
  assert.deepEqual(violations('a.bare', deps), ['a.bare -> VCRUNTIME140.dll', 'a.bare -> api-ms-win-crt-runtime-l1-1-0.dll'])
  assert.deepEqual(violations('b.dll', '    KERNEL32.dll\n    ADVAPI32.dll\n'), [])
})

test('vswhere output picks the x64-hosted x64 dumpbin, not a cross tool or a trailing CR', () => {
  const root = 'C:\\VS\\VC\\Tools\\MSVC\\14.51\\bin'
  const out = `${root}\\Hostx64\\arm64\\dumpbin.exe\r\n${root}\\Hostx64\\x64\\dumpbin.exe\r\n${root}\\Hostx86\\x86\\dumpbin.exe\r\n`
  assert.equal(pickDumpbin(out), `${root}\\Hostx64\\x64\\dumpbin.exe`)
  assert.equal(pickDumpbin(`${root}\\Hostx64\\arm64\\dumpbin.exe\r\n`), '')
})
