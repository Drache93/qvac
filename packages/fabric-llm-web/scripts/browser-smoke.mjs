import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const playwrightModule = process.env.QVAC_PLAYWRIGHT_MODULE
if (!playwrightModule)
  throw new Error(
    'Set QVAC_PLAYWRIGHT_MODULE to the installed Playwright index.mjs path'
  )
const { chromium } = await import(pathToFileURL(resolve(playwrightModule)).href)
const origin = process.env.QVAC_DEMO_URL ?? 'http://127.0.0.1:8787'
const modelSrc = new URL(
  process.env.QVAC_MODEL_URL ?? '/artifacts/models/Qwen3.5-2B-Q4_K_M.gguf',
  origin
).href
const artifactDir = resolve(
  process.env.QVAC_EVIDENCE_DIR ?? 'artifacts/browser-smoke'
)
const timeout = Number(process.env.QVAC_BROWSER_TIMEOUT_MS ?? 600000)
const flags = JSON.parse(process.env.QVAC_CHROME_FLAGS ?? '[]')
assert.ok(
  Array.isArray(flags) &&
    flags.every(function (flag) {
      return typeof flag === 'string'
    }),
  'QVAC_CHROME_FLAGS must be a JSON string array'
)
await mkdir(artifactDir, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  origin,
  modelSrc,
  build: 'compat',
  flags,
  console: [],
  pageErrors: [],
  failedRequests: [],
  checkpoints: []
}
let browser
let page

function checkpoint(message) {
  report.checkpoints.push({ at: new Date().toISOString(), message })
  console.log(`[browser-smoke] ${message}`)
}

async function waitForUI(expected) {
  await page.waitForFunction(
    function (expectedStatus) {
      const status = document.querySelector('#status')
      return (
        status.dataset.state === 'error' ||
        status.textContent === expectedStatus
      )
    },
    expected,
    { timeout }
  )
  assert.equal(
    await page.locator('#status').textContent(),
    expected,
    await page.locator('#error').textContent()
  )
}

async function saveEvidence(name) {
  const downloading = page.waitForEvent('download')
  await page.locator('#download-logs').click()
  const download = await downloading
  const path = resolve(artifactDir, `${name}.json`)
  await download.saveAs(path)
  return JSON.parse(await readFile(path, 'utf8'))
}

async function loadModel() {
  await page.locator('#load').click()
  await waitForUI('Ready')
  checkpoint('Model loaded through the browser SDK UI')
}

process.once('SIGINT', function () {
  console.error('[browser-smoke] Interrupted; closing Chromium')
  Promise.resolve(browser?.close()).finally(function () {
    process.exit(130)
  })
})

try {
  browser = await chromium.launch({
    executablePath:
      process.env.QVAC_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),
    headless: true,
    args: flags,
    timeout: 60000
  })
  report.chromium = browser.version()
  page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true
  })
  page.setDefaultTimeout(30000)
  page.on('console', function (message) {
    report.console.push({ type: message.type(), text: message.text() })
    if (message.text().startsWith('[benchmark]')) checkpoint(message.text())
  })
  page.on('pageerror', function (error) {
    report.pageErrors.push(String(error))
    console.error(`[browser-pageerror] ${error}`)
  })
  page.on('requestfailed', function (request) {
    report.failedRequests.push({
      url: request.url(),
      failure: request.failure()
    })
  })
  await page.goto(
    new URL(
      `demo/?model=${encodeURIComponent(modelSrc)}`,
      origin.endsWith('/') ? origin : `${origin}/`
    ).href
  )
  report.adapter = await page.evaluate(async function () {
    if (!navigator.gpu) return { webgpu: false, secureContext: isSecureContext }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    })
    if (!adapter) return { webgpu: true, adapter: false }
    return {
      webgpu: true,
      adapter: true,
      features: [...adapter.features],
      info: adapter.info?.toJSON?.() ?? {
        vendor: adapter.info?.vendor,
        architecture: adapter.info?.architecture,
        device: adapter.info?.device,
        description: adapter.info?.description
      },
      jspi: typeof WebAssembly.Suspending === 'function'
    }
  })
  checkpoint(
    `Chromium ${report.chromium}; adapter ${JSON.stringify(report.adapter)}`
  )
  assert.equal(
    report.adapter.adapter,
    true,
    'No browser WebGPU adapter; see adapter evidence'
  )
  assert.ok(
    report.adapter.features.includes('shader-f16'),
    'Selected browser adapter does not expose shader-f16'
  )
  await page.waitForFunction(function () {
    return (
      !document.querySelector('#load').disabled ||
      document.querySelector('#status').dataset.state === 'error'
    )
  })
  assert.equal(
    await page.locator('#webgpu-readiness').getAttribute('data-state'),
    'available',
    'Fabric WebGPU readiness indicator did not become available'
  )
  assert.equal(
    await page.locator('#error').isVisible(),
    false,
    await page.locator('#error').textContent()
  )
  await page.locator('#context').fill('2048')
  await loadModel()
  await page.locator('#prompt').fill('Reply with exactly one word: Paris.')
  await page.locator('#tokens').fill('128')
  await page.locator('#run').click()
  await waitForUI('Ready')
  report.firstOutput = await page.locator('#output').textContent()
  assert.match(
    report.firstOutput,
    /Paris/i,
    'Generation did not contain the expected answer; inspect raw output'
  )
  checkpoint(`Public SDK completion: ${JSON.stringify(report.firstOutput)}`)
  await page.screenshot({
    path: resolve(artifactDir, 'completion.png'),
    fullPage: true
  })
  const initialEvidence = await saveEvidence('ui-completion')
  assert.ok(
    initialEvidence.diagnostics.some(function (diagnostic) {
      return diagnostic.backend === 'WebGPU'
    }),
    'Engine did not report the WebGPU backend'
  )
  assert.equal(initialEvidence.runs[0].final.stats.backendDevice, 'gpu')
  await page.locator('#prompt').fill('Now reply with exactly one word: Rome.')
  await page.locator('#run').click()
  await waitForUI('Ready')
  report.secondTurnOutput = await page.locator('#output').textContent()
  assert.match(
    report.secondTurnOutput,
    /Rome/i,
    'Second-turn chat did not produce the expected answer'
  )
  checkpoint('Second-turn history completion passed')
  await page.locator('#clear').click()
  await page
    .locator('#prompt')
    .fill(
      'Count from one to one hundred, spelling out each number on its own line. Begin immediately.'
    )
  await page.locator('#tokens').fill('256')
  await page.locator('#run').click()
  await page.waitForFunction(
    function () {
      return (
        (document.querySelector('#output').textContent.length > 3 &&
          !document.querySelector('#stop').disabled) ||
        document.querySelector('#status').dataset.state === 'error'
      )
    },
    null,
    { timeout }
  )
  const cancellationStarted = Date.now()
  await page.locator('#stop').click()
  await waitForUI('Stopped')
  report.cancellationStopMs = Date.now() - cancellationStarted
  const stoppedEvidence = await saveEvidence('ui-cancelled')
  assert.ok(
    stoppedEvidence.runs.at(-1).events.some(function (event) {
      return event.type === 'completionDone' && event.stopReason === 'cancelled'
    })
  )
  checkpoint(
    `Accepted cancellation reached terminal state in ${report.cancellationStopMs} ms`
  )
  await page.locator('#unload').click()
  await waitForUI('Not loaded')
  checkpoint('Model unloaded')
  if (process.env.QVAC_SKIP_RELOAD !== '1') {
    await loadModel()
    await page.locator('#prompt').fill('Reply with exactly one word: Moon.')
    await page.locator('#tokens').fill('128')
    await page.locator('#run').click()
    await waitForUI('Ready')
    report.reloadOutput = await page.locator('#output').textContent()
    assert.match(report.reloadOutput, /Moon/i)
    checkpoint('Unload/reload completion passed')
  }
  await saveEvidence('ui-final')
  await page.locator('#close').click()
  await waitForUI('Closed')
  if (process.env.QVAC_SKIP_BENCHMARK !== '1') {
    checkpoint(
      'Starting interleaved low-level / SDK comparison with the same WASM runtime'
    )
    report.benchmark = await page.evaluate(
      async function ({ modelSrc }) {
        const [{ createBrowserRuntime }, { createBrowserClient }] =
          await Promise.all([
            import(new URL('../src/client.js', location.href).href),
            import(new URL('../dist/sdk-browser.js', location.href).href)
          ])
        const diagnostics = []
        const workerUrl = new URL('../src/worker.js', location.href)
        const runtime = createBrowserRuntime({
          worker: new Worker(workerUrl, { type: 'module' }),
          onLog: function (line) {
            console.log(line)
          },
          onDiagnostics: function (value) {
            diagnostics.push(value)
          }
        })
        const client = createBrowserClient(runtime)
        const modelId = await client.loadModel({ modelSrc, ctxSize: 2048 })
        const history = [
          {
            role: 'user',
            content:
              'Count from one to two hundred, spelling out every number on its own line. Start immediately and do not skip any numbers.'
          }
        ]
        const generationParams = { predict: 256, temp: 0, seed: 42 }
        const runs = []
        async function run(mode, warmup) {
          const start = performance.now()
          let firstTokenMs
          let text = ''
          let stats
          let stopReason
          if (mode === 'direct') {
            for await (const frame of runtime.streamCompletion({
              type: 'completionStream',
              modelId,
              history,
              stream: true,
              generationParams,
              requestId: crypto.randomUUID()
            })) {
              for (const event of frame.events) {
                if (event.type === 'contentDelta') {
                  firstTokenMs ??= performance.now() - start
                  text += event.text
                }
                if (event.type === 'completionStats') stats = event.stats
                if (event.type === 'completionDone') {
                  stopReason = event.stopReason
                  text = event.raw?.fullText ?? text
                }
              }
            }
          } else {
            const completion = client.completion({
              modelId,
              history,
              stream: true,
              generationParams
            })
            for await (const event of completion.events)
              if (event.type === 'contentDelta')
                firstTokenMs ??= performance.now() - start
            const final = await completion.final
            text = final.raw.fullText
            stats = final.stats
            stopReason = final.stopReason
          }
          const result = {
            mode,
            warmup,
            text,
            stats,
            stopReason,
            wallMs: performance.now() - start,
            firstTokenMs
          }
          console.log(
            `[benchmark] ${mode}${warmup ? ' warmup' : ''}: ${result.wallMs.toFixed(1)} ms; ${stats?.generatedTokens} tokens; ${stats?.tokensPerSecond?.toFixed(2)} t/s`
          )
          runs.push(result)
          return result
        }
        try {
          await run('direct', true)
          await run('sdk', true)
          for (let pair = 0; pair < 6; pair++) {
            const order = pair % 2 ? ['sdk', 'direct'] : ['direct', 'sdk']
            for (const mode of order) await run(mode, false)
          }
          return { diagnostics, runs, history, generationParams }
        } finally {
          await client.close()
        }
      },
      { modelSrc }
    )
    const measured = report.benchmark.runs.filter(function (run) {
      return !run.warmup
    })
    assert.ok(
      measured.every(function (run) {
        return run.text === measured[0].text
      }),
      'A/B output mismatch for identical greedy requests'
    )
    assert.ok(
      measured.every(function (run) {
        return run.stats.generatedTokens === measured[0].stats.generatedTokens
      }),
      'A/B generated-token count mismatch'
    )
    const direct = measured.filter(function (run) {
      return run.mode === 'direct'
    })
    const sdk = measured.filter(function (run) {
      return run.mode === 'sdk'
    })
    function median(values) {
      const sorted = [...values].sort(function (a, b) {
        return a - b
      })
      const middle = Math.floor(sorted.length / 2)
      return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2
    }
    report.benchmark.comparison = {
      medianDirectDecodeTPS: median(
        direct.map((run) => run.stats.tokensPerSecond)
      ),
      medianSDKDecodeTPS: median(sdk.map((run) => run.stats.tokensPerSecond)),
      sdkToDirectDecodePercent: sdk.map(function (run, index) {
        return (
          (100 * run.stats.tokensPerSecond) /
          direct[index].stats.tokensPerSecond
        )
      }),
      sdkToDirectWallPercent: sdk.map(function (run, index) {
        return (100 * run.wallMs) / direct[index].wallMs
      }),
      medianDirectWallMs: median(
        direct.map(function (run) {
          return run.wallMs
        })
      ),
      medianSDKWallMs: median(
        sdk.map(function (run) {
          return run.wallMs
        })
      )
    }
    checkpoint(`A/B completed: ${JSON.stringify(report.benchmark.comparison)}`)
  }
  assert.equal(
    report.pageErrors.length,
    0,
    'Browser page raised runtime errors'
  )
  report.passed = true
  checkpoint('Browser acceptance passed')
} catch (error) {
  report.passed = false
  report.error = error.stack ?? String(error)
  if (page && !page.isClosed()) {
    report.ui = await page
      .evaluate(function () {
        return Object.fromEntries(
          [
            'status',
            'error',
            'output',
            'capabilities',
            'diagnostics',
            'logs',
            'progress-text'
          ].map(function (id) {
            return [id, document.getElementById(id)?.textContent]
          })
        )
      })
      .catch(function (failure) {
        return { captureError: String(failure) }
      })
    await page
      .screenshot({ path: resolve(artifactDir, 'failure.png'), fullPage: true })
      .catch(function () {})
  }
  throw error
} finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(
    resolve(artifactDir, 'report.json'),
    JSON.stringify(report, null, 2)
  )
  await browser?.close()
  console.log(`[browser-smoke] Evidence: ${artifactDir}`)
}
