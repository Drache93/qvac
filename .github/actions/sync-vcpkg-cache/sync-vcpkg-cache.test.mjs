import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { hostDirFrom, syncInto } from './sync-vcpkg-cache.mjs'

test('the host dir is the first files source', () => {
  assert.equal(hostDirFrom('clear;files,/opt/c,write;files,/w,readwrite'), '/opt/c')
  assert.equal(hostDirFrom('clear;x-aws,s3://b/,readwrite'), '')
})

test('only archives the host lacks are copied, existing ones are left alone', () => {
  const ws = mkdtempSync(join(tmpdir(), 'ws-'))
  const host = mkdtempSync(join(tmpdir(), 'host-'))
  mkdirSync(join(ws, 'ab'), { recursive: true })
  writeFileSync(join(ws, 'ab/new.zip'), 'new')
  writeFileSync(join(ws, 'old.zip'), 'ws')
  writeFileSync(join(host, 'old.zip'), 'host')
  assert.equal(syncInto(ws, host), 1)
  assert.equal(readFileSync(join(host, 'ab/new.zip'), 'utf8'), 'new')
  assert.equal(readFileSync(join(host, 'old.zip'), 'utf8'), 'host')
  assert.equal(existsSync(join(host, `ab/new.zip.tmp.${process.pid}`)), false)
})
