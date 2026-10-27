/* global Bare */
// bare-stow's bundle shim as a plain file, so the sidecar can be spawned without stowing
import protocol from 'bare-stow/protocol'

const ipc = protocol.attach(Bare.IPC)

let stop = null
let readied = false
let exited = false

function ready() {
  if (readied) return
  readied = true

  ipc.send('ready')
}

async function shutdown(code, err = null) {
  if (exited) return
  exited = true

  try {
    if (stop) {
      await stop()
    }
  } catch (e) {
    err = err || e
  }

  if (err) {
    // the host may not be listening yet, so the reason also lands in the log
    console.error(err.stack || err.message || err)
    ipc.send('error', { message: err.message, stack: err.stack })
  }

  await ipc.send('exit', { code })

  Bare.exit(code)
}

ipc.on('terminate', () => shutdown(0))

Bare.on('beforeExit', (exitCode) => shutdown(exitCode))
  .on('uncaughtException', (err) => shutdown(1, err))
  .on('unhandledRejection', (err) => shutdown(1, err))

try {
  const entry = await import('./assistant-sidecar.mjs')
  const start = entry.default

  stop = (await start(ipc, ready)) || null

  ready()
} catch (err) {
  shutdown(1, err)
}
