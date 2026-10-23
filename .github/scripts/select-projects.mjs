#!/usr/bin/env node
// The one selection pass: which tagged packages run which targets, on which runners, from the trusted checkout.

import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { CPP_TEST_KEYS, PREBUILD_KEYS } from './prebuild-status/lib.mjs'

export const TAG = 'ci:contract'

// Platform and arch of each reusable-runner-names.yml key; the labels themselves stay in that file.
export const RUNNER_KEYS = {
  linux_ubuntu2204_x64: ['linux', 'x64'],
  linux_ubuntu2204_x64_gpu: ['linux', 'x64'],
  linux_ubuntu2404_x64: ['linux', 'x64'],
  linux_ubuntu2404_x64_gpu: ['linux', 'x64'],
  ubuntu_2204: ['linux', 'x64'],
  ubuntu_2404: ['linux', 'x64'],
  ubuntu_2604: ['linux', 'x64'],
  ubuntu_2204_arm: ['linux', 'arm64'],
  ubuntu_2404_arm: ['linux', 'arm64'],
  macos_arm64_gpu: ['darwin', 'arm64'],
  macos_15: ['darwin', 'arm64'],
  macos_ios: ['darwin', 'arm64'],
  macos_15_intel: ['darwin', 'x64'],
  macos_15_large: ['darwin', 'x64'],
  win_2025_x64: ['win32', 'x64'],
  win_2025_x64_gpu: ['win32', 'x64']
}

// A leg is one of a target's configurations: <platform>-<arch>[-simulator], holding only args or commands and a
// ci object with its runner. Anything else breaks the package standard (docs/ci/workflow-standard.md).
const LEG_NAME = /^(linux|android|ios|darwin|win32)-(x64|arm64)(-simulator)?$/
const LEG_KEYS = ['args', 'commands', 'ci']
const CI_KEYS = ['runner']

export function legs(project, target) {
  return Object.entries(project.targets[target].configurations ?? {}).map(([config, cfg]) => {
    const where = `${project.name} ${target} configuration ${config}`
    const m = config.match(LEG_NAME)
    if (!m) throw new Error(`${where}: the name must be <platform>-<arch>[-simulator]`)
    const extra = Object.keys(cfg).filter((k) => !LEG_KEYS.includes(k))
    if (extra.length)
      throw new Error(
        `${where}: only ${LEG_KEYS.join(', ')} are allowed, found ${extra.join(', ')}`
      )
    const ciExtra = Object.keys(cfg.ci ?? {}).filter((k) => !CI_KEYS.includes(k))
    if (ciExtra.length)
      throw new Error(`${where}: ci holds only ${CI_KEYS.join(', ')}, found ${ciExtra.join(', ')}`)
    if (!cfg.ci?.runner) throw new Error(`${where}: ci.runner names the runner key it runs on`)
    return { config, runnerKey: cfg.ci.runner, platform: m[1], arch: m[2], tags: m[3] ?? '' }
  })
}

export function parseRunnerLabels(yaml) {
  return Object.fromEntries(
    [...yaml.matchAll(/echo "([a-z0-9_]+)=([^"]+)" >> "\$GITHUB_OUTPUT"/g)].map((m) => [m[1], m[2]])
  )
}

// The gate's status key is the pr-gate-merge.yml filter key whose first path is the package; later paths are dependencies.
export function gateKeys(gateYaml) {
  const keys = {}
  let key = null
  for (const line of gateYaml.split('\n')) {
    const k = line.match(/^ {12}([a-z0-9-]+):\s*$/)
    if (k) {
      key = k[1]
      continue
    }
    const p = line.match(/^ {14}- "([^"]+)"/)
    if (!p || !key) continue
    const dir = p[1].match(/^packages\/([^/]+)\/\*\*$/)
    if (dir) keys[dir[1]] ??= key
    key = null
  }
  return keys
}

export function rows(project, target, labels) {
  // A target running on another's rows inherits that target's settings under its own.
  const meta = {
    ...project.targets[project.rowsFrom?.[target]]?.metadata,
    ...project.targets[target]?.metadata
  }
  const base = {
    project: project.name,
    dir: project.root,
    target,
    timeout: meta.timeoutMinutes ?? 0,
    meta
  }
  const runners = meta.runners ?? project.targets[project.rowsFrom?.[target]]?.metadata?.runners
  // A target with no runners is one job per package, on whatever runner the group picks.
  if (target !== 'build' && !runners)
    return [{ ...base, platform: '', arch: '', tags: '', runner: '' }]
  const keys =
    target === 'build' ? legs(project, 'build') : runners.map((runnerKey) => ({ runnerKey }))
  return keys.map((leg) => {
    const [platform, arch] = RUNNER_KEYS[leg.runnerKey] ?? []
    const runner = labels[leg.runnerKey]
    if (!runner || !platform)
      throw new Error(`${project.name} ${target}: unknown runner key ${leg.runnerKey}`)
    return { ...base, platform, arch, tags: '', ...leg, runner }
  })
}

// cpp:tests runs on cpp:build's rows, in the same job.
const ROWS_FROM = { 'cpp:tests': 'cpp:build' }

// Owner targets run only for packages the change touched, not for their dependents; owners null means every package.
export function select({
  graph,
  affected,
  targets,
  labels,
  gate,
  owners = null,
  ownerTargets = []
}) {
  const tagged = Object.values(graph.nodes).filter((n) => n.data.tags?.includes(TAG))
  const chosen = tagged.filter((n) => affected === null || affected.includes(n.name))
  const out = { matrices: {}, projects: [] }
  for (const t of targets) out.matrices[t] = []
  for (const n of chosen) {
    const project = {
      name: n.name,
      root: n.data.root,
      targets: n.data.targets,
      rowsFrom: ROWS_FROM
    }
    const dir = n.data.root.split('/').pop()
    const npm = n.data.metadata?.js?.packageName ?? n.name
    const own = targets.filter(
      (t) =>
        n.data.targets[t] &&
        (owners === null || !ownerTargets.includes(t) || owners.includes(n.name))
    )
    if (!own.length) continue
    const commands = Object.fromEntries(
      own.map((t) => [
        t,
        {
          command: n.data.targets[t].options?.command ?? '',
          cwd: n.data.targets[t].options?.cwd ?? n.data.root
        }
      ])
    )
    const { provider, providerArtifact } = nativeProvider(graph, n.name, gate)
    const common = {
      slug: dir,
      npm,
      key: gate[dir] ?? '',
      provider,
      providerArtifact,
      targets: own,
      commands
    }
    out.projects.push({
      name: n.name,
      dir: n.data.root,
      ...common,
      prebuildStatus: PREBUILD_KEYS.includes(gate[dir]),
      cppStatus: CPP_TEST_KEYS.includes(gate[dir])
    })
    for (const t of own) {
      const cmd = n.data.targets[t].options ?? {}
      for (const r of rows(project, t, labels))
        out.matrices[t].push({
          ...r,
          ...common,
          command: cmd.command ?? '',
          cwd: cmd.cwd ?? n.data.root
        })
    }
  }
  return out
}

// The npm dependency the gate expects prebuilds from, and its <dir>-prebuilds bundle; its platform packages provide the addon's symbols.
export function nativeProvider(graph, name, gate) {
  const dep = (graph.dependencies[name] ?? []).find(
    (d) =>
      d.type === 'static' &&
      graph.nodes[d.target] &&
      PREBUILD_KEYS.includes(gate[graph.nodes[d.target].data.root.split('/').pop()])
  )
  if (!dep) return { provider: '', providerArtifact: '' }
  const node = graph.nodes[dep.target]
  return {
    provider: node.data.metadata?.js?.packageName ?? dep.target,
    providerArtifact: `${node.data.root.split('/').pop()}-prebuilds`
  }
}

// "desktop=test:integration+test:backend" adds one matrix holding both targets' rows, for targets that share a job.
export function combine(matrices, spec = '') {
  const out = {}
  for (const part of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [name, targets] = part.split('=')
    out[name] = targets.split('+').flatMap((t) => matrices[t] ?? [])
  }
  return out
}

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()
const ZERO = /^0+$/

// Which commits a run compares. A pull request, on either PR event, is compared from its common ancestor with the
// base, as GitHub's "Files changed" shows it. workflow_call carries its caller's event, so it needs no row of its own.
export function resolveRange({ eventName, event, packages = [], defaultBranch, sha, ref }) {
  if (packages.length) return { explicit: packages }
  const pr = event.pull_request
  if (pr)
    return {
      base: pr.base.sha,
      head: pr.head.sha,
      mergeBase: true,
      headRepo: pr.head.repo?.full_name
    }
  if (eventName === 'merge_group')
    return { base: event.merge_group.base_sha, head: event.merge_group.head_sha }
  if (eventName === 'push') {
    const head = event.after || sha
    if (event.before && !ZERO.test(event.before)) return { base: event.before, head }
    return { base: `origin/${defaultBranch}`, head, mergeBase: true }
  }
  if (eventName === 'workflow_dispatch' && defaultBranch && ref !== `refs/heads/${defaultBranch}`) {
    return { base: `origin/${defaultBranch}`, head: sha, mergeBase: true }
  }
  return { all: true }
}

// Commits and trees only: paths are all a diff needs. --no-renames lists a move under both packages.
export function changedFiles(range, run = git) {
  const fetch = (rev, from = 'origin') =>
    run(['fetch', '--no-tags', '--filter=blob:none', from, rev])
  for (const rev of [range.base, range.head]) {
    if (rev.startsWith('origin/')) continue
    try {
      fetch(rev)
    } catch (e) {
      if (rev !== range.head || !range.headRepo) throw e
      fetch(rev, `https://github.com/${range.headRepo}.git`)
    }
  }
  const base = range.mergeBase ? run(['merge-base', range.base, range.head]) : range.base
  return run(['diff', '--name-only', '--no-renames', base, range.head]).split('\n').filter(Boolean)
}

// A changed path belongs to the package whose root holds it.
export function ownersOf(graph, files) {
  return Object.values(graph.nodes)
    .filter((n) => files.some((f) => f.startsWith(`${n.data.root}/`)))
    .map((n) => n.name)
}

function main(env) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  const targets = env.TARGETS.split(/[\s,]+/).filter(Boolean)
  const tmp = join(env.RUNNER_TEMP, 'nx-graph.json')
  execFileSync('pnpm', ['exec', 'nx', 'graph', `--file=${tmp}`], { stdio: 'inherit' })
  const graph = JSON.parse(readFileSync(tmp, 'utf8')).graph
  const range = resolveRange({
    eventName: env.GITHUB_EVENT_NAME,
    event,
    sha: env.GITHUB_SHA,
    ref: env.GITHUB_REF,
    packages: (env.PACKAGES || '').split(/[\s,]+/).filter(Boolean),
    defaultBranch: event.repository?.default_branch
  })
  // affected and owners stay null for "every tagged package": a named list, or no change worth diffing.
  let files = null
  let affected = null
  let owners = null
  if (range.explicit) {
    affected = Object.values(graph.nodes)
      .filter(
        (n) =>
          range.explicit.includes(n.name) || range.explicit.includes(n.data.root.split('/').pop())
      )
      .map((n) => n.name)
  } else if (!range.all) {
    try {
      files = changedFiles(range)
      console.log(`${files.length} files changed in ${range.base}..${range.head}`)
    } catch (e) {
      console.log(
        `::warning::could not diff ${range.base}..${range.head}, selecting every tagged package: ${e.message}`
      )
    }
  }
  if (files) {
    owners = ownersOf(graph, files)
    affected =
      env.MODE === 'owners' || !files.length
        ? owners
        : JSON.parse(
            execFileSync(
              'pnpm',
              [
                'exec',
                'nx',
                'show',
                'projects',
                '--affected',
                `--files=${files.join(',')}`,
                '--json'
              ],
              { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
            )
          )
  }
  const labels = parseRunnerLabels(
    readFileSync('.github/workflows/reusable-runner-names.yml', 'utf8')
  )
  const result = select({
    graph,
    affected,
    targets,
    labels,
    owners,
    ownerTargets: (env.OWNER_TARGETS || '').split(/[\s,]+/).filter(Boolean),
    gate: gateKeys(readFileSync('.github/workflows/pr-gate-merge.yml', 'utf8'))
  })
  Object.assign(result.matrices, combine(result.matrices, env.COMBINE))
  for (const [t, r] of Object.entries(result.matrices))
    console.log(
      `${t}: ${r.map((x) => `${x.project}@${x.platform}-${x.arch}${x.tags}`).join(' ') || 'none'}`
    )
  appendFileSync(
    env.GITHUB_OUTPUT,
    `matrices=${JSON.stringify(result.matrices)}\nprojects=${JSON.stringify(result.projects)}\nrunners=${JSON.stringify(labels)}\nany=${result.projects.length > 0}\n`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.env)
