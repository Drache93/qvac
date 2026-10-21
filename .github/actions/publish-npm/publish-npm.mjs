#!/usr/bin/env node
// Gate, idempotency check and publish in one place; a re-run never publishes over an existing version.

import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// dev and tmp are prerelease tags that never go to npm; anything else must come from a release branch.
export function gate({ tag, ref }) {
  if (tag === 'dev' || tag === 'tmp') return false
  if (!ref.startsWith('refs/heads/release-')) throw new Error(`npm publishes from a release-* branch only, got ${ref}`)
  return true
}

// `npm view <pkg> versions --json` is an array, a bare string for one version, or an E404 for none.
export function alreadyPublished({ status, stdout }, version) {
  if (status !== 0) {
    let code
    try {
      code = JSON.parse(stdout).error?.code
    } catch {}
    if (!stdout.trim() || code === 'E404') return false
    throw new Error(`npm view failed (exit ${status}); re-run after the registry recovers`)
  }
  const versions = JSON.parse(stdout || '[]')
  return [versions].flat().includes(version)
}

export function publishArgs(tag, access) {
  return ['publish', '--tag', tag, '--access', access, ...(access === 'public' ? ['--provenance'] : [])]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env
  const { name, version } = JSON.parse(readFileSync(join(env.WORKDIR, 'package.json'), 'utf8'))
  let published = ''
  if (!gate({ tag: env.TAG, ref: env.GITHUB_REF })) console.log(`Skipping npm publish: prerelease tag ${env.TAG}`)
  else if (alreadyPublished(spawnSync('npm', ['view', name, 'versions', '--json'], { encoding: 'utf8' }), version)) {
    console.log(`Skipping npm publish: ${name}@${version} is already on npm`)
  } else {
    execFileSync('npm', publishArgs(env.TAG, env.ACCESS), { cwd: env.WORKDIR, stdio: 'inherit' })
    published = version
    console.log(`::notice title=npm published::${name}@${version} (${env.TAG})`)
  }
  appendFileSync(env.GITHUB_OUTPUT, `version=${published}\n`)
}
