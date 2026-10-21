#!/usr/bin/env node
// latest only for a stable version at or above npm's latest; anything else lands on release-<major>.<minor>.

import { appendFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const core = (v) => v.replace(/^v/, '').split('-')[0].split('.').map(Number)

export function decide({ version, latest, tag }) {
  if (tag && tag !== 'latest') return tag
  const [a, b, c] = core(version)
  const [x, y, z] = core(latest)
  return !version.includes('-') && (a - x || b - y || c - z) >= 0 ? 'latest' : `release-${a}.${b}`
}

// A package npm has never seen starts from 0.0.0; any other registry failure stops the release.
export function latestFrom({ status, stdout }) {
  if (status === 0) return JSON.parse(stdout || '"0.0.0"') || '0.0.0'
  let code
  try {
    code = JSON.parse(stdout).error?.code
  } catch {}
  if (code === 'E404') return '0.0.0'
  throw new Error(`npm view failed (exit ${status}); re-run after the registry recovers, or pass an explicit tag`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { name, version } = JSON.parse(readFileSync(join(process.env.WORKDIR, 'package.json'), 'utf8'))
  let tag = process.env.TAG
  if (!tag || tag === 'latest') {
    const r = spawnSync('npm', ['view', name, 'dist-tags.latest', '--json'], { encoding: 'utf8' })
    tag = decide({ version, latest: latestFrom(r) })
  }
  console.log(`${name}@${version}: ${tag}`)
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`)
}
