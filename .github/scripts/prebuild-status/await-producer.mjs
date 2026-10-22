#!/usr/bin/env node
// Waits for an untagged dependency's prebuild status and prints its producing run id.

import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import {
  LOOKUP_FAILED,
  classifyState,
  flattenPages,
  newestTrustedStatus,
  parseRunId
} from './lib.mjs'

export async function awaitProducer({
  pkg,
  prUpdatedEpoch,
  fetchStatuses,
  lookupRun,
  now,
  sleep,
  pollIntervalMs,
  timeoutMs,
  log
}) {
  const deadline = now() + timeoutMs
  for (;;) {
    let newest = null
    try {
      newest = newestTrustedStatus(fetchStatuses(), pkg, prUpdatedEpoch, lookupRun)
    } catch (err) {
      log(`::warning::statuses fetch failed, retrying: ${err.message}`)
    }
    const state = newest ? classifyState(newest.state) : 'pending'
    if (state === 'success') return { code: 0, runId: parseRunId(newest.target_url) }
    if (state === 'failed') {
      log(`::error::qvac/prebuild-${pkg} failed in its producer run`)
      return { code: 1, runId: '' }
    }
    if (now() >= deadline) {
      log(`::error::No fresh qvac/prebuild-${pkg} status before the timeout`)
      return { code: 1, runId: '' }
    }
    log(`Waiting on qvac/prebuild-${pkg}`)
    await sleep(pollIntervalMs)
  }
}

const gh = (args) => {
  const out = execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  }).trim()
  return out ? JSON.parse(out) : null
}

export function awaitProducerFromEnv(env) {
  const lookupRun = (id) => {
    if (!id) return null
    try {
      return gh([`repos/${env.REPO}/actions/runs/${id}`])
    } catch (err) {
      return /\b404\b|Not Found/i.test(`${err?.stderr ?? ''}${err?.message ?? ''}`)
        ? null
        : LOOKUP_FAILED
    }
  }
  return awaitProducer({
    pkg: env.PACKAGE,
    prUpdatedEpoch: Math.floor(Date.parse(env.PR_UPDATED_AT) / 1000),
    fetchStatuses: () =>
      flattenPages(
        gh([`repos/${env.REPO}/commits/${env.HEAD_SHA}/statuses`, '--paginate', '--slurp']) ?? []
      ),
    lookupRun,
    now: () => Date.now(),
    sleep,
    pollIntervalMs: 120_000,
    timeoutMs: 180 * 60 * 1000,
    log: (m) => console.log(m)
  })
}

async function main(env) {
  const { code, runId } = await awaitProducerFromEnv(env)
  if (runId) appendFileSync(env.GITHUB_OUTPUT, `run-id=${runId}\n`)
  process.exitCode = code
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.env)
