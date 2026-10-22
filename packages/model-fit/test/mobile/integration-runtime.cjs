'use strict'

/* global Bare */

const path = require('bare-path')
const fs = require('bare-fs')
const { pathToFileURL } = require('bare-url')

// A dlopen failure (or any other unhandled error) MUST fail the run, not just
// get logged. Bare surfaces addon-load failures -- e.g. the
// @qvac/tts-ggml@0.2.1 ggml_backend_is_cpu dlopen crash -- as an
// unhandledRejection on the worklet thread; a log-only handler turned that
// into a false-green Device Farm run. Catch to avoid the abrupt SIGABRT,
// record every failure, and force a non-zero exit on drain so CI sees it.
const _integrationFatalErrors = []
if (typeof Bare !== 'undefined' && typeof Bare.on === 'function') {
  Bare.on('unhandledRejection', (reason) => {
    _integrationFatalErrors.push(reason || new Error('unhandledRejection'))
    console.error(
      '[integration-runner] Unhandled rejection:',
      reason instanceof Error ? reason.stack : reason
    )
  })
  Bare.on('uncaughtException', (err) => {
    _integrationFatalErrors.push(err || new Error('uncaughtException'))
    console.error(
      '[integration-runner] Uncaught exception:',
      err instanceof Error ? err.stack : err
    )
  })
  Bare.on('beforeExit', () => {
    if (_integrationFatalErrors.length === 0) return
    console.error('[integration-runner] FATAL: failing run due to an earlier unhandled error.')
    if (typeof Bare.exit === 'function') Bare.exit(1)
    else if (typeof process !== 'undefined' && process.exit) process.exit(1)
  })
}

// Failed summary for a fatal error recorded since `mark`, or null when the module was clean.
function fatalSummarySince(mark) {
  if (_integrationFatalErrors.length <= mark) return null
  const err = _integrationFatalErrors[mark]
  return {
    total: 1,
    passed: 0,
    failed: 1,
    error: {
      message: (err && err.message) || String(err),
      code: err && err.code,
      stack: err && err.stack
    }
  }
}

// lunte-disable-next-line no-unused-vars
async function runIntegrationModule(relativeModulePath, options = {}) {
  const modulePath = path.join(__dirname, relativeModulePath)

  if (!fs.existsSync(modulePath)) {
    console.warn(`[integration-runner] Missing module: ${relativeModulePath}`)
    return 'missing'
  }

  const fatalMark = _integrationFatalErrors.length
  const moduleUrl = pathToFileURL(modulePath).href
  try {
    await import(moduleUrl)
  } catch (error) {
    console.error(`[integration-runner] Module failed to load or run: ${error.message}`)
    return {
      modulePath,
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 0)) // let a last-tick rejection reach the handler
  const fatal = fatalSummarySince(fatalMark)
  if (fatal) {
    console.error(
      `[integration-runner] ${relativeModulePath} raised a fatal error outside the test tally`
    )
    return { modulePath, summary: fatal }
  }
  return { modulePath, summary: null }
}

global.runIntegrationModule = runIntegrationModule
