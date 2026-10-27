import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const cli = process.env.QVAC_CLI_TEST_PACKAGE || fileURLToPath(new URL('../..', import.meta.url))
const host = `${process.platform}-${process.arch}`

test(
  'SDK bundle and verify use native TypeScript enums and aliases without tsx',
  { timeout: 180000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-sdk-native-config-'))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const scope = path.join(root, 'node_modules/@qvac')
    fs.mkdirSync(scope, { recursive: true })
    const search = createRequire(path.join(cli, 'package.json')).resolve.paths('@qvac/sdk') || []
    const sdkPath = search
      .map((directory) => path.join(directory, '@qvac/sdk'))
      .find((directory) => fs.existsSync(path.join(directory, 'package.json')))
    assert.ok(sdkPath, 'installed SDK dependency is resolvable from CLI')
    const sdk = fs.realpathSync(sdkPath)
    const seen = new Set()
    for (const source of [
      path.join(sdk, 'node_modules/@qvac'),
      ...search.map((directory) => path.join(directory, '@qvac'))
    ]) {
      if (!fs.existsSync(source)) continue
      for (const name of fs.readdirSync(source)) {
        if (seen.has(name) || name.startsWith('.')) continue
        seen.add(name)
        fs.symlinkSync(path.join(source, name), path.join(scope, name), 'junction')
      }
    }
    fs.writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@settings/*': ['./settings/*'] } }
      })
    )
    fs.mkdirSync(path.join(root, 'settings'))
    fs.writeFileSync(
      path.join(root, 'settings/plugins.ts'),
      `enum Plugin { Classification = '@qvac/sdk/ggml-classification/plugin' }; export const plugins: string[] = [Plugin.Classification]`
    )
    fs.writeFileSync(path.join(root, 'local.ts'), 'export const audio: boolean = false')
    fs.writeFileSync(
      path.join(root, 'qvac.config.ts'),
      `import { plugins } from '@settings/plugins'; import { audio } from './local.js'; export default { plugins, includeAudioDecoder: audio }`
    )
    const deny = path.join(root, 'deny-tsx.mjs')
    fs.writeFileSync(
      deny,
      `import { registerHooks } from 'node:module'; registerHooks({ resolve(specifier, context, next) { if (specifier === 'tsx' || specifier.startsWith('tsx/') || specifier.includes('/node_modules/tsx/')) throw new Error('External tsx must not be loaded'); return next(specifier, context) } })`
    )
    const run = (args) =>
      exec(process.execPath, ['--import', deny, path.join(cli, 'dist/index.js'), 'sdk', ...args], {
        cwd: root,
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024
      })
    const bundled = await run([
      'bundle',
      'sdk',
      '--host',
      host,
      '--config',
      'qvac.config.ts',
      '--offline',
      '--no-install'
    ])
    assert.doesNotMatch(bundled.stderr, /External tsx|requires the optional peer dependency/)
    const entry = fs.readFileSync(path.join(root, 'qvac/worker.entry.mjs'), 'utf8')
    assert.match(entry, /ggml-classification\/plugin/)
    assert.doesNotMatch(entry, /llamacpp-completion\/plugin/)
    const verified = await run([
      'verify',
      'bundle',
      '--addons-source',
      path.join(root, 'qvac/worker.bundle.js'),
      '--host',
      host,
      '--config',
      'qvac.config.ts',
      '--offline',
      '--json',
      '--quiet'
    ])
    const result = JSON.parse(verified.stdout)
    assert.ok(
      !result.issues.some((issue) => issue.level === 'error'),
      JSON.stringify(result.issues)
    )
    assert.ok(!result.issues.some((issue) => issue.code === 'config-load-failed'))
  }
)
