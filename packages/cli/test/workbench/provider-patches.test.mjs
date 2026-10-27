import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { planPackagePatch } from '../../scripts/patch-dependencies.mjs'

test('provider patch planning preserves pristine inputs and includes new runtime files', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-provider-patch-'))
  t.after(() => fs.rmSync(target, { recursive: true, force: true }))
  fs.writeFileSync(
    path.join(target, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0' })
  )
  fs.writeFileSync(path.join(target, 'runtime.js'), 'original\n')
  const patch = path.join(target, 'compat.patch')
  fs.writeFileSync(
    patch,
    [
      'diff --git a/runtime.js b/runtime.js',
      '--- a/runtime.js',
      '+++ b/runtime.js',
      '@@ -1 +1 @@',
      '-original',
      '+compatible',
      'diff --git a/shim.js b/shim.js',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/shim.js',
      '@@ -0,0 +1 @@',
      '+shim',
      ''
    ].join('\n')
  )
  const changes = planPackagePatch('fixture@1.0.0', { target, patch })
  assert.deepEqual(changes, [
    { destination: path.join(target, 'runtime.js'), after: 'compatible\n' },
    { destination: path.join(target, 'shim.js'), after: 'shim\n' }
  ])
  assert.equal(fs.readFileSync(path.join(target, 'runtime.js'), 'utf8'), 'original\n')
  assert.equal(fs.existsSync(path.join(target, 'shim.js')), false)
  for (const { destination, after } of changes) fs.writeFileSync(destination, after)
  assert.deepEqual(planPackagePatch('fixture@1.0.0', { target, patch }), [])
  assert.throws(() => planPackagePatch('fixture@2.0.0', { target, patch }), /Cannot patch/)
  fs.writeFileSync(path.join(target, 'runtime.js'), 'unexpected\n')
  assert.throws(() => planPackagePatch('fixture@1.0.0', { target, patch }), /[Pp]atch|hunk/)
  assert.equal(fs.readFileSync(path.join(target, 'runtime.js'), 'utf8'), 'unexpected\n')
})
