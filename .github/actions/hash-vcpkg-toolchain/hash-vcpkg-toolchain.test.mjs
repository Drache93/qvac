import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import { fingerprint, unixProbe, windowsProbe } from './hash-vcpkg-toolchain.mjs'

const clang = 'Apple clang version 17.0.0\nTarget: arm64-apple-darwin25\nThread model: posix'

test('the unix probe and digest equal the old bash printf | sha256sum', () => {
  const probe = unixProbe({ os: 'macOS', clangVersion: clang, sdkBuild: '25A123', vcpkgVersion: 'vcpkg package management program version 2026-09-01' })
  const old = execFileSync('bash', ['-c', 'printf "%s" "$P" | (command -v sha256sum >/dev/null && sha256sum || shasum -a 256)'], {
    encoding: 'utf8',
    env: { ...process.env, P: probe },
  })
  assert.equal(probe, `${clang}\nsdk=25A123\nvcpkg=vcpkg package management program version 2026-09-01`)
  assert.equal(fingerprint(probe), old.slice(0, 16))
})

test('linux has no sdk line, windows uses the single-line form', () => {
  assert.equal(unixProbe({ os: 'Linux', clangVersion: 'clang 22', vcpkgVersion: 'v' }), 'clang 22\nvcpkg=v')
  assert.equal(windowsProbe({ toolsVersion: '14.44', sdkVersion: '10.0.26100.0', vcpkgVersion: ' v \r' }), 'vctools=14.44 sdk=10.0.26100.0 vcpkg=v')
})
