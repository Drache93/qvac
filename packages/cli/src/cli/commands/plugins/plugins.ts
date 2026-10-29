import { spawn } from '#child_process'
import path from '#path'
import type { ParsedCommand, LauncherKit } from '../../../lib/types.js'
import { CommandError } from '../../errors.js'
import { PLUGIN_CATALOG } from '../../../lib/runtime/plugin-catalog.js'
import {
  pluginPath,
  installedNames,
  pluginsPath,
  type InstalledFS
} from '../../../lib/runtime/installed-plugins.js'
import {
  readPluginState,
  setEnabled,
  writePluginState,
  type PluginStateFS
} from '../../../lib/runtime/plugin-state.js'

type FS = LauncherKit['fs']

const isCatalog = (id: string) => PLUGIN_CATALOG.some((entry) => entry.id === id)
const HYPER = 'hyper://'

// qvac plugins list: what is installed and whether it loads, then enabled names that are nowhere
export function listPlugins(
  dataDir: string,
  fs: InstalledFS & Pick<PluginStateFS, 'readFileSync'>
) {
  const state = readPluginState(dataDir, fs)
  const installed = installedNames(dataDir, fs)
  const lines = installed.map(
    (name) => `${name}  ${state.enabled.includes(name) ? 'enabled' : 'disabled'}`
  )
  for (const id of state.enabled) {
    if (!installed.includes(id) && !isCatalog(id)) {
      lines.push(`${id}  missing`)
    }
  }

  return lines.length ? lines.join('\n') : `no plugins installed in ${pluginsPath(dataDir)}`
}

function git(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'ignore', 'inherit'] })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new CommandError(`git ${args[0]} failed (exit ${code})`))
    )
  })
}

const repoName = (url: string) =>
  url
    .split(/[\\/:]/)
    .filter(Boolean)
    .at(-1)!
    .replace(/\.git$/, '')

// qvac plugins install <source> [name]: copied in, not turned on
export async function installPlugin(dataDir: string, fs: FS, source: string, given?: string) {
  const hyper = source.startsWith(HYPER)
  if (hyper && !given) {
    throw new CommandError(
      'a hyper:// source needs a name: qvac plugins install hyper://<key> <name>',
      {
        code: 2
      }
    )
  }

  const name = given || repoName(source)
  if (path.basename(name) !== name) {
    throw new CommandError(`the name ${name} must not contain a path separator`, { code: 2 })
  }

  if (isCatalog(name)) {
    throw new CommandError(`${name} is a catalog plugin; install it under another name`, {
      code: 2
    })
  }

  const dest = pluginPath(dataDir, name)
  if (fs.existsSync(dest)) {
    throw new CommandError(`${name} is already installed in ${dest}`)
  }

  try {
    if (hyper) {
      fs.mkdirSync(dest, { recursive: true })
      await (
        await import('./hyper.js')
      ).fetchDrive(source.slice(HYPER.length).split('/')[0]!, dest, fs)
    } else {
      await git(['clone', '-q', '--depth', '1', '--', source, dest])
    }
  } catch (error) {
    fs.rmSync(dest, { recursive: true, force: true })
    throw error
  }

  return `installed ${name}; run qvac plugins enable ${name} to load it`
}

// qvac plugins enable|disable <name>: options[name] stays, so turning off loses nothing
export function togglePlugin(dataDir: string, fs: FS, name: string, on: boolean) {
  if (on && !isCatalog(name) && !installedNames(dataDir, fs).includes(name)) {
    throw new CommandError(
      `${name} is not installed in ${pluginsPath(dataDir)} and is not a catalog plugin`
    )
  }

  writePluginState(dataDir, setEnabled(readPluginState(dataDir, fs), name, on), fs)

  return `${on ? 'enabled' : 'disabled'} ${name}; it applies at the next qvac start`
}

// every plugins command reads the data dir the same way and reports a failure as one line
async function run(
  { options }: ParsedCommand,
  { loadConfig, dataDir, process }: LauncherKit,
  act: (dir: string) => Promise<string> | string
) {
  const { core } = (await loadConfig(options.configFile)).config
  try {
    console.log(await act(dataDir(options, core)))
  } catch (error) {
    console.error(`qvac: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(error instanceof CommandError ? error.code : 1)
  }
}

export const runList = (parsed: ParsedCommand, kit: LauncherKit) =>
  run(parsed, kit, (dir) => listPlugins(dir, kit.fs))

export const runInstall = (parsed: ParsedCommand, kit: LauncherKit) =>
  run(parsed, kit, (dir) => installPlugin(dir, kit.fs, parsed.words[0]!, parsed.words[1]))

export const runEnable = (parsed: ParsedCommand, kit: LauncherKit) =>
  run(parsed, kit, (dir) => togglePlugin(dir, kit.fs, parsed.words[0]!, true))

export const runDisable = (parsed: ParsedCommand, kit: LauncherKit) =>
  run(parsed, kit, (dir) => togglePlugin(dir, kit.fs, parsed.words[0]!, false))
