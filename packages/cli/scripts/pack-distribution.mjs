// Build a reproducible npm archive without replacing workspace dependency links.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const destination = path.resolve(process.argv[2] || root)
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-distribution-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args, cwd = stage) => execFileSync(command, args, { cwd, stdio: 'inherit' })

try {
  run(process.execPath, ['scripts/prepare-qvac-vendors.mjs'], root)
  run(process.execPath, ['scripts/check-publish-ready.cjs'], root)
  // These are the manifest's publication inputs. npm applies its files allowlist
  // when creating the archive after the isolated dependency tree is installed.
  for (const name of [
    'package.json',
    'npm-shrinkwrap.json',
    '.npmignore',
    'dist',
    'scripts',
    'skills',
    'docs',
    'vendor',
    'README.md',
    'LICENSE',
    'NOTICE'
  ]) {
    const source = path.join(root, name)
    if (!fs.existsSync(source)) continue
    fs.cpSync(source, path.join(stage, name), {
      recursive: true,
      mode: fs.constants.COPYFILE_FICLONE,
      filter: (file) => !file.split(path.sep).includes('node_modules')
    })
  }
  run(npm, ['ci', '--omit=dev', '--ignore-scripts', '--install-links', '--no-audit', '--no-fund'])
  fs.mkdirSync(destination, { recursive: true })
  run(npm, ['pack', '--ignore-scripts=false', '--pack-destination', destination])
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}
