// The unstowed counterpart of bare-stow's shim, using the CLI's explicit composition.
import protocol from 'bare-stow/protocol'
import start from './harness-entry.js'

const ipc = protocol.attach(Bare.IPC)
let stop: (() => void | Promise<void>) | null = null
let readied = false
let exited = false
function ready() {
  if (readied) return
  readied = true
  void ipc.send('ready')
}
async function shutdown(code: number, reason: unknown = null) {
  if (exited) return
  exited = true
  let error = reason
  try {
    await stop?.()
  } catch (cause) {
    error ||= cause
  }
  try {
    if (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      await ipc.send('error', { message: cause.message, stack: cause.stack })
    }
    await ipc.send('exit', { code })
  } finally {
    // Parent disconnects must not leave a stopped worker waiting on a failed report.
    Bare.exit(code)
  }
}
ipc.on('terminate', () => void shutdown(0))
Bare.on('beforeExit', (code: number) => void shutdown(code))
Bare.on('uncaughtException', (error: unknown) => void shutdown(1, error))
Bare.on('unhandledRejection', (error: unknown) => void shutdown(1, error))
try {
  stop = await start(ipc, ready)
  ready()
} catch (error) {
  await shutdown(1, error)
}
