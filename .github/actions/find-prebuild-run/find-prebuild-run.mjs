#!/usr/bin/env node
// The marker carries the PR number, so a PR only ever reuses its own prebuilds.

import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function hasBoth(artifacts, marker, artifactName) {
  const names = new Set((artifacts || []).filter((a) => a && !a.expired).map((a) => a.name))
  return names.has(marker) && names.has(artifactName)
}

export async function findRun({ runs, currentRunId, listArtifacts, marker, artifactName }) {
  for (const run of runs || []) {
    if (String(run.id) === String(currentRunId)) continue
    if (hasBoth(await listArtifacts(run.id), marker, artifactName)) return String(run.id)
  }
  return ''
}

async function api(path, token) {
  const base = process.env.GITHUB_API_URL || 'https://api.github.com'
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  })
  return res.ok ? res.json() : null
}

async function main(env) {
  const repo = env.REPO
  const runs = await api(
    `/repos/${repo}/actions/workflows/${env.WORKFLOW_FILE}/runs?branch=${encodeURIComponent(env.BRANCH)}&per_page=40`,
    env.GH_TOKEN,
  )
  const runId = await findRun({
    runs: runs?.workflow_runs,
    currentRunId: env.RUN_ID,
    listArtifacts: async (id) => (await api(`/repos/${repo}/actions/runs/${id}/artifacts?per_page=100`, env.GH_TOKEN))?.artifacts,
    marker: env.MARKER,
    artifactName: env.ARTIFACT_NAME,
  })
  console.log(runId ? `Reusable prebuilds in run ${runId}` : `No prior run carries ${env.MARKER}`)
  appendFileSync(env.GITHUB_OUTPUT, `run-id=${runId}\nhit=${Boolean(runId)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.env)
