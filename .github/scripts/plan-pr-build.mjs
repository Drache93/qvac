#!/usr/bin/env node
// Turns each package's reuse result and dependency waits into the build rows and prebuild sources for this run.

import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { awaitProducerFromEnv } from './prebuild-status/await-producer.mjs'

export function readPlans(dir) {
  if (!dir || !existsSync(dir)) return {}
  const plans = {}
  for (const f of readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    plans[p.dir] = p
  }
  return plans
}

export function plan({ projects, build, plans, runId }) {
  for (const p of projects) if (p.waits.length > 1) throw new Error(`${p.name} waits on ${p.waits.length} dependencies; the build overlays one`)
  const reused = Object.fromEntries(projects.map((p) => [p.dir, plans[p.dir]?.hit === true]))
  return {
    build: build.filter((r) => !reused[r.dir]),
    reused,
    sources: Object.fromEntries(projects.map((p) => [p.dir, reused[p.dir] ? plans[p.dir].runId : runId])),
    hashes: Object.fromEntries(projects.map((p) => [p.dir, plans[p.dir]?.hash ?? ''])),
    waits: [...new Map(projects.flatMap((p) => p.waits).map((w) => [w.key, w])).values()],
  }
}

async function main(env) {
  const projects = JSON.parse(env.PROJECTS || '[]')
  const p = plan({ projects, build: JSON.parse(env.BUILD || '[]'), plans: readPlans(env.PLANS_DIR), runId: env.GITHUB_RUN_ID })
  const deps = {}
  if (env.AWAIT === 'true') {
    for (const w of p.waits) {
      const { code, runId } = await awaitProducerFromEnv({ ...env, PACKAGE: w.key })
      if (code) process.exit(code)
      deps[w.key] = runId
    }
  }
  for (const [dir, hit] of Object.entries(p.reused)) console.log(`${dir}: ${hit ? `reusing run ${p.sources[dir]}` : 'building'}`)
  const out = { build: p.build, reused: p.reused, sources: p.sources, hashes: p.hashes, deps }
  appendFileSync(env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${JSON.stringify(v)}\n`).join(''))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.env)
