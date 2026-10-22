#!/usr/bin/env node
// Read-only: fetches the PR head as objects, never checks out PR code.

import { createHash } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TRUSTED_EVENTS = ['workflow_dispatch', 'workflow_call', 'push']
const HASH_LINE =
  /\.(cpp|hpp|c|h)$|CMakeLists\.txt$|vcpkg\.json$|vcpkg-configuration\.json$|\/vcpkg\/|vcpkg-overlays\/|cmake\/qvac-addon\//

// Keep in lockstep with HASH_LINE.
export function isNative(file, workdir) {
  const inPkg = file.startsWith(`${workdir}/`)
  if (inPkg && /\.(cpp|hpp|c|h)$/.test(file)) return true
  if (inPkg && file.endsWith('CMakeLists.txt')) return true
  if (file === `${workdir}/vcpkg.json` || file === `${workdir}/vcpkg-configuration.json`)
    return true
  if (file.startsWith(`${workdir}/vcpkg/`)) return true
  return file.startsWith('vcpkg-overlays/') || file.startsWith('cmake/qvac-addon/')
}

export function nativeHash(lsTreeOutput) {
  const lines = lsTreeOutput.split('\n').filter((l) => l && HASH_LINE.test(l))
  return createHash('sha256')
    .update(lines.map((l) => `${l}\n`).join(''))
    .digest('hex')
    .slice(0, 16)
}

export function diffBase({ action, baseSha, headSha, beforeSha }) {
  if (action === 'opened') return baseSha
  if (beforeSha && beforeSha !== headSha) return beforeSha
  return headSha
}

const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
const tryGit = (...args) => {
  try {
    return git(...args)
  } catch {
    return null
  }
}

function fetchHead({ headSha, headRepo, headRef }, depth = 1) {
  if (tryGit('fetch', 'origin', headSha, `--depth=${depth}`) !== null) return headSha
  if (!headRepo || !headRef) return null
  if (tryGit('fetch', `https://github.com/${headRepo}.git`, headRef, `--depth=${depth}`) === null)
    return null
  return git('rev-parse', 'FETCH_HEAD').trim()
}

function detect(env) {
  const now = Math.floor(Date.now() / 1000)
  if (TRUSTED_EVENTS.includes(env.EVENT_NAME)) return { changed: true, hash: `dispatch-${now}` }
  const pr = {
    headSha: env.HEAD_SHA,
    headRepo: env.HEAD_REPO,
    headRef: env.HEAD_REF
  }
  const headSha = env.HEAD_SHA ? fetchHead(pr) : null
  if (!headSha)
    return {
      changed: true,
      hash: `unfetchable-${now}`,
      warn: 'Could not fetch PR head, treating as changed'
    }
  let from = diffBase({
    action: env.EVENT_ACTION,
    baseSha: env.BASE_SHA,
    headSha,
    beforeSha: env.BEFORE_SHA
  })
  if (
    from === env.BEFORE_SHA &&
    tryGit('cat-file', '-e', from) === null &&
    tryGit('fetch', 'origin', from, '--depth=1') === null
  ) {
    if (pr.headRepo && pr.headRef)
      tryGit('fetch', `https://github.com/${pr.headRepo}.git`, pr.headRef, '--depth=50')
    if (tryGit('cat-file', '-e', from) === null) from = env.BASE_SHA
  }
  if (from && tryGit('cat-file', '-e', from) === null) tryGit('fetch', 'origin', from, '--depth=1')
  if (!from)
    return {
      changed: true,
      hash: nativeHash(
        tryGit('ls-tree', '-r', headSha, '--', env.WORKDIR, 'vcpkg-overlays', 'cmake/qvac-addon') ||
          ''
      )
    }
  const diff = tryGit('diff', '--name-only', from, headSha, '--')
  if (diff === null)
    return {
      changed: true,
      hash: `diff-failed-${now}`,
      warn: 'git diff failed, treating as changed'
    }
  const changed = diff.split('\n').some((f) => f && isNative(f, env.WORKDIR))
  const tree =
    tryGit('ls-tree', '-r', headSha, '--', env.WORKDIR, 'vcpkg-overlays', 'cmake/qvac-addon') || ''
  return { changed, hash: nativeHash(tree) }
}

function main(env) {
  const r = detect(env)
  if (r.warn) console.log(`::warning::${r.warn}`)
  console.log(`Native changed: ${r.changed} | Hash: ${r.hash}`)
  appendFileSync(env.GITHUB_OUTPUT, `native_changed=${r.changed}\nnative_hash=${r.hash}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.env)
