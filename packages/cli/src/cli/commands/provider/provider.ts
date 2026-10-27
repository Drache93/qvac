import { spawn } from '#child_process'
import { fileURLToPath } from '#url'
import type { ParsedCommand, LauncherKit } from '../../../lib/types.js'
export async function runProvider(parsed: ParsedCommand, kit: LauncherKit) {
  const loaded = await kit.loadConfig(parsed.options.configFile)
  const dataDir = kit.dataDir(parsed.options, loaded.config.core)
  const args = [parsed.action || '', parsed.words[0] || '', dataDir]
  if (typeof Bare !== 'undefined') {
    const { providerOperation } = await import('../../../lib/runtime/provider-operation.js')
    console.log(JSON.stringify(await providerOperation(args)))
    return
  }
  // The Node launcher delegates only this operation; it does not boot Core or Harness.
  const nodeModule = 'node:module'
  const { createRequire } = (await import(nodeModule)) as typeof import('node:module')
  const require = createRequire(import.meta.url)
  const binary: string = require('bare-runtime')()
  if (kit.process.platform !== 'win32') kit.fs.chmodSync(binary, 0o755)
  const entry = fileURLToPath(new URL('../../provider-entry.js', import.meta.url))
  kit.supervise(spawn(binary, [entry, ...args], { stdio: 'inherit' }))
}
