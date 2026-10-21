import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { isExact, isGprRegistry, isRegistrySpec, nameOf, packPrebuilds, sliceFor, specFor } from './pack-npm-prebuilds.mjs'

// Fake npm: `npm pack <spec>` unpacks the registry entry for spec straight into dest/package.
function fakeRun(registry, calls = []) {
  return (cmd, args, opts) => {
    calls.push([cmd, ...args].join(' '))
    if (cmd === 'npm' && args[0] === 'config') return 'https://npm.pkg.github.com/\n'
    if (cmd !== 'npm') return
    const entry = registry[args[1]]
    if (!entry) throw new Error(`404 ${args[1]}`)
    const dest = args[args.indexOf('--pack-destination') + 1]
    mkdirSync(join(dest, 'package'), { recursive: true })
    writeFileSync(join(dest, 'x.tgz'), '')
    writeFileSync(join(dest, 'package/package.json'), JSON.stringify(entry.manifest))
    for (const f of entry.files || []) {
      mkdirSync(join(dest, 'package', f, '..'), { recursive: true })
      writeFileSync(join(dest, 'package', f), '')
    }
    if (opts.cwd && existsSync(join(opts.cwd, '.npmrc'))) calls.push(`mode ${(statSync(join(opts.cwd, '.npmrc')).mode & 0o777).toString(8)}`)
  }
}

const base = () => ({ workdir: mkdtempSync(join(tmpdir(), 'pk-')), addon: '@qvac/vla-ggml', platform: 'Android', tmp: mkdtempSync(join(tmpdir(), 'rt-')) })

test('only plain registry specs reach npm', () => {
  assert.equal(specFor('', '@qvac/a'), '@qvac/a@latest')
  assert.equal(specFor('1.2.0', '@qvac/a'), '@qvac/a@1.2.0')
  assert.equal(specFor('@tetherto/a-mono@1.0.0-tmp.1', '@qvac/a'), '@tetherto/a-mono@1.0.0-tmp.1')
  for (const bad of ['@qvac/a@git+https://x', '@evil/a@1', 'github:o/r', '@qvac/a@1 --x']) assert.equal(isRegistrySpec(bad), false, bad)
  assert.equal(nameOf('@qvac/a@1.0.0'), '@qvac/a')
  assert.equal(nameOf('@tetherto/a-mono'), '@tetherto/a-mono')
})

test('the GPR registry is matched by host, not by prefix', () => {
  assert.equal(isGprRegistry('https://npm.pkg.github.com'), true)
  assert.equal(isGprRegistry('https://npm.pkg.github.com/'), true)
  assert.equal(isGprRegistry('https://npm.pkg.github.com.evil.example/'), false)
  assert.equal(isGprRegistry('http://npm.pkg.github.com'), false)
  assert.equal(isGprRegistry('not a url'), false)
})

test('an exact version is recognised quickly, even on input built to backtrack', () => {
  assert.equal(isExact('0.33.0'), true)
  assert.equal(isExact('0.33.0-tmp.pr-12.runid-9'), true)
  assert.equal(isExact('1.0.0+build.5'), true)
  assert.equal(isExact('^0.33.0'), false)
  const start = Date.now()
  assert.equal(isExact(`0.0.0+${'--'.repeat(5000)}!`), false)
  assert.ok(Date.now() - start < 100)
})

test('an npmjs build lands its prebuilds/ in the package', () => {
  const o = base()
  packPrebuilds({ ...o, pkg: '0.4.0', pinned: true, run: fakeRun({ '@qvac/vla-ggml@0.4.0': { manifest: { name: '@qvac/vla-ggml', version: '0.4.0' }, files: ['prebuilds/android-arm64/a.bare'] } }) })
  assert.ok(existsSync(join(o.workdir, 'prebuilds/android-arm64/a.bare')))
})

test('a GPR build writes a private .npmrc that is gone afterwards', () => {
  const o = base()
  const calls = []
  const spec = '@tetherto/vla-ggml-mono@1.0.0-tmp.9'
  packPrebuilds({ ...o, pkg: spec, token: 't', run: fakeRun({ [spec]: { manifest: { name: '@tetherto/vla-ggml-mono', version: '1.0.0-tmp.9' }, files: ['prebuilds/ios-arm64/a.bare'] } }, calls) })
  assert.ok(calls.includes('mode 600'))
  assert.equal(existsSync(join(o.tmp, 'gpr-prebuild-pack')), false)
  assert.throws(() => packPrebuilds({ ...base(), pkg: spec, token: '', run: fakeRun({}) }), /no token/)
})

test('another addon, a broken pin, or a GPR build without prebuilds is refused', () => {
  const llm = { '@qvac/llm@1.0.0': { manifest: { name: '@qvac/llm', version: '1.0.0' }, files: ['prebuilds/x'] } }
  assert.throws(() => packPrebuilds({ ...base(), pkg: '@qvac/llm@1.0.0', run: fakeRun(llm) }), /not a build of @qvac\/vla-ggml/)
  const moved = { '@qvac/vla-ggml@1.0.0': { manifest: { name: '@qvac/vla-ggml', version: '1.0.1' }, files: ['prebuilds/x'] } }
  assert.throws(() => packPrebuilds({ ...base(), pkg: '1.0.0', pinned: true, run: fakeRun(moved) }), /pin is 1.0.0/)
  const bare = { '@tetherto/vla-ggml-mono@1.0.0': { manifest: { name: '@tetherto/vla-ggml-mono', version: '1.0.0' } } }
  assert.throws(() => packPrebuilds({ ...base(), pkg: '@tetherto/vla-ggml-mono@1.0.0', token: 't', run: fakeRun(bare) }), /never sliced/)
})

test('a split addon resolves the slice its #host-addon map confirms', () => {
  const meta = { name: '@qvac/vla-ggml', version: '1.0.0', imports: { '#host-addon': { android: { arm64: '@qvac/vla-ggml-android-arm64' }, ios: '@qvac/vla-ggml-ios' } } }
  assert.equal(sliceFor(meta, 'iOS'), '@qvac/vla-ggml-ios@1.0.0')
  assert.throws(() => sliceFor({ ...meta, imports: { '#host-addon': { ios: '@evil/x' } } }, 'iOS'), /does not name/)
  assert.throws(() => sliceFor({ ...meta, version: 'evil/repo' }, 'iOS'), /not an exact version/)
  const o = base()
  packPrebuilds({ ...o, pkg: '', run: fakeRun({
    '@qvac/vla-ggml@latest': { manifest: meta },
    '@qvac/vla-ggml-android-arm64@1.0.0': { manifest: { name: '@qvac/vla-ggml-android-arm64', version: '1.0.0' }, files: ['prebuilds/android-arm64/a.bare'] },
  }) })
  assert.ok(existsSync(join(o.workdir, 'prebuilds/android-arm64/a.bare')))
})

test('present prebuilds are kept unless the build is pinned', () => {
  const o = base()
  mkdirSync(join(o.workdir, 'prebuilds/old'), { recursive: true })
  packPrebuilds({ ...o, pkg: '', run: () => assert.fail('must not pack') })
  assert.ok(existsSync(join(o.workdir, 'prebuilds/old')))
})
