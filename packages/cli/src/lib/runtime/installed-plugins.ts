import path from '#path'

export interface InstalledFS {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
  readdirSync(path: string): string[]
  statSync(path: string): { isDirectory(): boolean }
}
type Target = string | { import?: string; default?: string } | undefined

// A plugin you install is a folder here, found by name.
export const pluginsPath = (dataDir: string) => path.join(dataDir, 'plugins')
export const pluginPath = (dataDir: string, name: string) => path.join(pluginsPath(dataDir), name)

export function installedNames(dataDir: string, fs: InstalledFS) {
  const dir = pluginsPath(dataDir)
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort()
}

export const hasPackage = (dataDir: string, name: string, fs: Pick<InstalledFS, 'existsSync'>) =>
  fs.existsSync(path.join(pluginPath(dataDir, name), 'package.json'))

// exports["."], then main, then index.js: the file a plugin folder loads from
export function pluginEntry(dataDir: string, name: string, fs: Pick<InstalledFS, 'readFileSync'>) {
  const dir = pluginPath(dataDir, name)
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    exports?: string | { '.'?: Target }
    main?: string
  }
  const root = typeof pkg.exports === 'string' ? pkg.exports : pkg.exports?.['.']
  const target = typeof root === 'string' ? root : (root?.import ?? root?.default)

  return path.join(dir, target ?? pkg.main ?? 'index.js')
}
