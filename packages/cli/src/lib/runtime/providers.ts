import fs from 'bare-fs'
import path from 'bare-path'
import process from 'bare-process'
import { fileURLToPath, pathToFileURL } from 'bare-url'
import Module from 'bare-module'
import Corestore from 'corestore'
import Import from 'bundlebee-import'
import Bundlebee from 'bundlebee'
import { PluginRegistry } from '@qvac/harness/plugins'

export type ProviderId = 'python' | 'quickjs'
export interface PreparedProvider {
  pin: Bundlebee.ReleasePin
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function providerPin(value: unknown): Bundlebee.ReleasePin {
  if (!isRecord(value) || !('pin' in value)) {
    throw new Error(
      'This runtime needs options.provider: { pin }. Prepare its provider before enabling it.'
    )
  }
  return Bundlebee.validateRelease(value['pin'])
}

export async function loadPreparedProvider(
  id: ProviderId,
  value: unknown,
  dataDir: string,
  { store: borrowed }: { store?: Corestore | undefined } = {}
): Promise<Record<string, unknown>> {
  const pin = providerPin(value)
  const directory = path.join(dataDir, 'providers')
  const assets = path.join(directory, 'assets')
  const store = borrowed || new Corestore(path.join(directory, 'cores'))
  try {
    // Import is cache-only. Provider preparation is always a separate explicit operation.
    const descriptor: unknown = await Import(store, pin, { assetDirectory: assets })
    if (
      !isRecord(descriptor) ||
      descriptor['format'] !== 1 ||
      descriptor['id'] !== id ||
      descriptor['harnessAPI'] !== PluginRegistry.API_VERSION ||
      descriptor['platform'] !== process.platform ||
      descriptor['arch'] !== process.arch ||
      typeof descriptor['entry'] !== 'string'
    ) {
      throw new Error(
        `Provider does not implement the ${id} contract for Harness API ${PluginRegistry.API_VERSION} on ${process.platform}-${process.arch}`
      )
    }
    const root = fs.realpathSync(
      path.join(assets, `${pin.key}-${pin.length}-${process.platform}-${process.arch}`)
    )
    const entry = fs.realpathSync(descriptor['entry'])
    if (!entry.startsWith(root + path.sep) || !fs.statSync(entry).isFile()) {
      throw new Error('Provider entry is outside its pinned asset cache')
    }
    // The separate module loader has no ambient filesystem protocol. Give it only
    // this release's files, so package resolution cannot reach an ancestor install.
    const localPath = (url: Parameters<typeof fileURLToPath>[0]) => {
      const candidate = fileURLToPath(url)
      if (!candidate.startsWith(root + path.sep)) return null
      if (!fs.existsSync(candidate)) return null
      const actual = fs.realpathSync(candidate)
      return actual.startsWith(root + path.sep) ? actual : null
    }
    const protocol = new Module.Protocol({
      exists(url) {
        const file = localPath(url)
        return file !== null && fs.statSync(file).isFile()
      },
      read(url) {
        const file = localPath(url)
        return file !== null && fs.statSync(file).isFile() ? fs.readFileSync(file) : null
      },
      *list(url) {
        const directory = localPath(url)
        if (!directory || !fs.statSync(directory).isDirectory()) return
        for (const name of fs.readdirSync(directory)) {
          yield pathToFileURL(path.join(directory, name))
        }
      }
    })
    const loaded = (
      await Module.load(pathToFileURL(entry), { protocol, cache: Object.create(null) })
    ).exports
    if (!isRecord(loaded)) throw new Error('Provider entry must export its plugin constructor')
    return loaded
  } finally {
    if (!borrowed) await store.close()
  }
}

export async function prepareProvider(
  pin: Bundlebee.ReleasePin,
  dataDir: string,
  options: Import.NetworkOptions = {},
  { store: borrowed }: { store?: Corestore | undefined } = {}
) {
  const store = borrowed || new Corestore(path.join(dataDir, 'providers', 'cores'))
  try {
    return await Import.prepare(store, pin, options)
  } finally {
    if (!borrowed) await store.close()
  }
}
