// Rebuild the unpublished provider-delivery dependencies from their reviewed sibling checkouts.
// Usage: node scripts/sync-runtime-vendors.mjs /path/to/bundlebee /path/to/pear-import
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const names = ['bundlebee', 'bundlebee-import']
if (process.argv.length !== 4) {
  throw new Error('Pass the bundlebee and bundlebee-import source directories')
}
for (const [i, name] of names.entries()) {
  const source = path.resolve(process.argv[i + 2])
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  if (manifest.name !== name || manifest.version !== '2.0.0') {
    throw new Error(`Expected ${name}@2.0.0`)
  }
  execFileSync('npm', ['run', 'build'], { cwd: source, stdio: 'inherit' })
  const target = path.join(root, 'vendor', name)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  for (const file of [...new Set([...manifest.files, 'package.json', 'LICENSE', 'README.md'])]) {
    if (file.includes('..') || path.isAbsolute(file)) {
      throw new Error('Unexpected package file: ' + file)
    }
    fs.cpSync(path.join(source, file), path.join(target, file), { recursive: true })
  }
  if (name === 'bundlebee-import') {
    const published = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
    published.dependencies.bundlebee = '2.0.0'
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(published, null, 2) + '\n')
  }
  const hashes = {}
  function hashFiles(dir, prefix = '') {
    for (const file of fs.readdirSync(dir).sort()) {
      const relative = prefix + file
      const absolute = path.join(dir, file)
      if (fs.statSync(absolute).isDirectory()) hashFiles(absolute, relative + '/')
      else {
        hashes[relative] = crypto
          .createHash('sha256')
          .update(fs.readFileSync(absolute))
          .digest('hex')
      }
    }
  }
  hashFiles(target)
  const provenance = {
    name,
    version: manifest.version,
    repository:
      typeof manifest.repository === 'string' ? manifest.repository : manifest.repository.url,
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: source,
      encoding: 'utf8'
    }).trim(),
    sourceBranch: execFileSync('git', ['branch', '--show-current'], {
      cwd: source,
      encoding: 'utf8'
    }).trim(),
    changes:
      name === 'bundlebee-import'
        ? ['Pin the unpublished bundlebee dependency to the exact bundled sibling version.']
        : [],
    sourceHash: crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
    files: hashes
  }
  fs.writeFileSync(path.join(target, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n')
  console.log(`${name}@${manifest.version}: ${provenance.sourceHash}`)
}
