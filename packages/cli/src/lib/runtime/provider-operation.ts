import fs from 'bare-fs'
import path from 'bare-path'
import { pathToFileURL } from 'bare-url'
import Corestore from 'corestore'
import Bundlebee from 'bundlebee'
import { prepareProvider } from './providers.js'
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
export async function providerOperation([action, input, dataDir]: string[]) {
  if (!input || !dataDir) throw new Error('A provider file and device data directory are required')
  if (action === 'prepare') {
    const document: unknown = JSON.parse(fs.readFileSync(input, 'utf8'))
    const wrapped = isRecord(document) && 'pin' in document
    const pin = Bundlebee.validateRelease(wrapped ? document['pin'] : document)
    const options: Parameters<typeof prepareProvider>[2] = {}
    if (wrapped) {
      const peers = document['blindPeers']
      if (peers !== undefined) {
        if (!Array.isArray(peers) || !peers.every((peer: unknown) => typeof peer === 'string')) {
          throw new Error('blindPeers must be public-key strings')
        }
        options.blindPeers = peers
      }
      const fallback = document['fallback']
      if (fallback !== undefined) {
        if (typeof fallback !== 'boolean') throw new Error('fallback must be a boolean')
        options.fallback = fallback
      }
    }
    return prepareProvider(pin, dataDir, options)
  }
  if (action !== 'publish') throw new Error('Expected provider prepare or publish')
  const directory = path.resolve(input)
  const metadata: unknown = JSON.parse(
    fs.readFileSync(path.join(directory, 'provider.json'), 'utf8')
  )
  if (
    !isRecord(metadata) ||
    !['python', 'quickjs'].includes(String(metadata['id'])) ||
    typeof metadata['version'] !== 'string' ||
    typeof metadata['abi'] !== 'number' ||
    !Array.isArray(metadata['assets']) ||
    !metadata['assets'].every((value: unknown) => typeof value === 'string')
  ) {
    throw new Error('Invalid staged provider manifest')
  }
  const store = new Corestore(path.join(dataDir, 'providers', 'cores'))
  const bee = new Bundlebee(store.session(), { name: `qvac-provider-${metadata['id']}` })
  try {
    return await bee.publish(new URL(pathToFileURL(directory + path.sep).href), 'release.cjs', {
      name: `@qvac/provider-${metadata['id']}`,
      version: metadata['version'],
      abi: metadata['abi'],
      assets: metadata['assets']
    })
  } finally {
    try {
      await bee.close()
    } finally {
      await store.close()
    }
  }
}
