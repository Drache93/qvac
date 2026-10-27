// Build the two provider directories first; this test never opens a network transport.
import fs from 'bare-fs'
import os from 'bare-os'
import path from 'bare-path'
import Corestore from 'corestore'
import { CodeMode } from '@qvac/harness/plugins/code-mode'
import process from 'bare-process'
import Bundlebee from 'bundlebee'
import { pathToFileURL } from 'bare-url'
import { compiledModule } from '../helpers/package-under-test.mjs'
const { providerOperation } = await import(compiledModule('lib/runtime/provider-operation.js').href)
const { loadPreparedProvider, prepareProvider } = await import(
  compiledModule('lib/runtime/providers.js').href
)
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-provider-test-'))
const assert = (value, message) => {
  if (!value) throw new Error(message)
}
const rejects = async (fn, pattern) => {
  try {
    await fn()
  } catch (error) {
    assert(pattern.test(`${error.code}: ${error}`), `Unexpected rejection: ${error}`)
    return
  }
  throw new Error(`Expected rejection: ${pattern}`)
}
const keep = setInterval(() => {}, 1000)
const timeout = setTimeout(() => {
  console.error('Provider smoke timed out')
  Bare.exit(1)
}, 90000)
try {
  await rejects(() => loadPreparedProvider('quickjs', {}, root), /options.provider/)
  for (const [index, id] of ['quickjs', 'python'].entries()) {
    const stage = Bare.argv[index + 2]
    assert(stage, 'Usage: providers-smoke.mjs QUICKJS_STAGE PYTHON_STAGE')
    const publisherDir = path.join(root, `publisher-${id}`)
    const pin = await providerOperation(['publish', stage, publisherDir])
    const consumerDir = path.join(root, `consumer-${id}`)
    await rejects(() => loadPreparedProvider(id, { pin }, consumerDir), /ERR_RELEASE_NOT_CACHED/)
    const source = new Corestore(path.join(publisherDir, 'providers/cores'))
    const consumer = new Corestore(path.join(consumerDir, 'providers/cores'))
    const left = source.replicate(true),
      right = consumer.replicate(false)
    left.pipe(right).pipe(left)
    const bee = new Bundlebee(consumer.session(), { key: pin.key, length: pin.length })
    await bee.prefetch(pin)
    await bee.close()
    left.destroy()
    right.destroy()
    await source.close()
    // The publisher is closed. Both preparation and execution now use cached blocks only.
    await prepareProvider(pin, consumerDir, { offline: true }, { store: consumer })
    assert(!consumer.closed, 'prepare must not close a borrowed store')
    const module = await loadPreparedProvider(id, { pin }, consumerDir, { store: consumer })
    assert(!consumer.closed, 'load must not close a borrowed store')
    await consumer.close()
    // Execution remains usable after both stores have closed: workers and WASM use pinned assets.
    if (id === 'quickjs') {
      const quickjs = new module.QuickJs()
      try {
        const result = await quickjs.run('return await tools.sum({ a: 20, b: 22 })', {
          bindings: { tools: { sum: async ({ a, b }) => a + b } }
        })
        assert(result.value === 42, `QuickJS host-call result: ${JSON.stringify(result)}`)
        const codeMode = new CodeMode({ quickjs, read: ['run_code'] })
        let called = 0
        const callTool = Object.assign(
          async (name, input) => {
            assert(name === 'sum', 'Code mode must use the host tool dispatcher')
            called++
            return input.a + input.b
          },
          { names: ['sum'] }
        )
        const value = await codeMode
          .setup()
          .tools[0].execute({ code: 'return await tools.sum({ a: 40, b: 2 })' }, { callTool })
        assert(
          value.result === 42 && called === 1,
          'Host code mode must reuse the prepared QuickJS instance and tool dispatch'
        )
      } finally {
        await quickjs.setup().teardown()
      }
    } else {
      try {
        const result = await module.runPython('print(6 * 7)', { network: false, timeoutMs: 30000 })
        assert(
          result.stdout === '42\n' && result.exitCode === 0,
          `Python worker result: ${JSON.stringify(result)}`
        )
      } finally {
        await module.closePythonWorker()
      }
    }
    await rejects(
      () => loadPreparedProvider(id === 'python' ? 'quickjs' : 'python', { pin }, consumerDir),
      /contract/
    )
    // Owned-store calls close their handles; reopening and preparing must succeed.
    await prepareProvider(pin, consumerDir, { offline: true })
    console.log(
      `PASS ${id}: replicated assets, offline execution, host call/worker, store ownership, contract`
    )
  }
  // Even a trusted descriptor cannot point its entry outside the exact release asset directory.
  const bad = path.join(root, 'bad')
  fs.mkdirSync(bad)
  fs.writeFileSync(
    path.join(bad, 'entry.cjs'),
    `module.exports = { format:1, id:'quickjs', harnessAPI:1, platform:${JSON.stringify(process.platform)}, arch:${JSON.stringify(process.arch)}, entry:${JSON.stringify(import.meta.filename)} }`
  )
  fs.writeFileSync(path.join(bad, 'present.txt'), 'asset')
  const badDir = path.join(root, 'bad-device')
  const store = new Corestore(path.join(badDir, 'providers/cores'))
  const bee = new Bundlebee(store.session())
  const pin = await bee.publish(pathToFileURL(bad + path.sep), 'entry.cjs', {
    name: 'bad-provider',
    version: '1.0.0',
    abi: 1,
    assets: ['present.txt']
  })
  await bee.close()
  await store.close()
  await rejects(() => loadPreparedProvider('quickjs', { pin }, badDir), /pinned asset cache/)
  console.log('PASS provider entry confinement')
} finally {
  clearInterval(keep)
  clearTimeout(timeout)
  fs.rmSync(root, { recursive: true, force: true })
}
