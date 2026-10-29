import os from '#os'
import path from '#path'
import { CommandError } from '../../errors.js'

interface Drive {
  list(folder: string, options: { recursive: boolean }): AsyncIterable<{ key: string }>
  get(key: string): Promise<Uint8Array | null>
}
interface FS {
  mkdirSync(path: string, options: { recursive: true }): unknown
  writeFileSync(path: string, data: Uint8Array): unknown
}

// Every file of the drive into dest; an entry that would land outside dest is refused.
export async function copyDrive(drive: Drive, dest: string, fs: FS) {
  const root = path.resolve(dest)
  let count = 0
  for await (const { key } of drive.list('/', { recursive: true })) {
    const file = path.resolve(root, `.${key}`)
    if (!file.startsWith(root + path.sep)) {
      throw new CommandError(`the drive has an entry outside the plugin folder: ${key}`)
    }

    const data = await drive.get(key)
    if (data) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, data)
      count++
    }
  }

  return count
}

export async function fetchDrive(
  key: string,
  dest: string,
  fs: FS & { mkdtempSync(prefix: string): string; rmSync(path: string, options: object): unknown }
) {
  const [
    { default: Corestore },
    { default: Hyperswarm },
    { default: Hyperdrive },
    { default: ids }
  ] = await Promise.all([
    import('corestore'),
    import('hyperswarm'),
    import('hyperdrive'),
    import('hypercore-id-encoding')
  ])
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-plugin-'))
  const store = new Corestore(tmp)
  const swarm = new Hyperswarm()
  swarm.on('connection', (connection) => store.replicate(connection))
  const drive = new Hyperdrive(store, ids.decode(key))
  try {
    await drive.ready()
    const found = drive.findingPeers()
    swarm.join(drive.discoveryKey, { client: true, server: false }).flushed().then(found, found)
    await drive.update({ wait: true })
    if (!(await copyDrive(drive, dest, fs))) {
      throw new CommandError(`no files arrived from hyper://${key}; is a peer seeding it?`)
    }
  } finally {
    await drive.close()
    await swarm.destroy()
    await store.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
