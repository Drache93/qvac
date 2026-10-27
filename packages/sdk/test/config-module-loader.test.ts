import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  loadConfigFromPath,
  withConfigModuleLoader
} from '@/client/config-loader/resolve-config.node'
import { ConfigFileParseFailedError } from '@/utils/errors-client'

test('host config loaders are scoped across nested and concurrent async commands', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-sdk-config-loader-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'qvac.config.ts')
  const loader = (name: string) => async (url: string) => {
    assert.equal(url, pathToFileURL(file).href)
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { default: { plugins: [name] } }
  }
  await Promise.all(
    ['first', 'second'].map((name) =>
      withConfigModuleLoader(loader(name), async () => {
        assert.deepEqual((await loadConfigFromPath(file)).plugins, [name])
        await withConfigModuleLoader(loader('nested'), async () => {
          assert.deepEqual((await loadConfigFromPath(file)).plugins, ['nested'])
        })
        assert.deepEqual((await loadConfigFromPath(file)).plugins, [name])
      })
    )
  )
  // The scoped importer must not leak into the SDK's ordinary fallback path.
  fs.writeFileSync(file, 'export default { plugins: ["fallback"] }')
  assert.deepEqual((await loadConfigFromPath(file)).plugins, ['fallback'])
})

test('host config loader failures retain the structured SDK error and original cause', async () => {
  const cause = new Error('native config import failed')
  await assert.rejects(
    withConfigModuleLoader(
      async () => {
        throw cause
      },
      () => loadConfigFromPath('/config.ts')
    ),
    (error: unknown) => {
      assert.ok(error instanceof ConfigFileParseFailedError)
      assert.equal(error.cause, cause)
      return true
    }
  )
})
