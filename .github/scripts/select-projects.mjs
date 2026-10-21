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
  win_2025_x64_gpu: ['win32', 'x64'],
}

// reusable-prebuilds.yml's default legs, which every native package builds.
export const BUILD_LEGS = [
  { runnerKey: 'linux_ubuntu2204_x64', platform: 'linux', arch: 'x64' },
  { runnerKey: 'ubuntu_2204_arm', platform: 'linux', arch: 'arm64' },
  { runnerKey: 'ubuntu_2404', platform: 'android', arch: 'arm64' },
  { runnerKey: 'macos_15', platform: 'ios', arch: 'arm64' },
  { runnerKey: 'macos_15', platform: 'ios', arch: 'arm64', tags: '-simulator', flags: '--simulator' },
  { runnerKey: 'macos_15', platform: 'ios', arch: 'x64', tags: '-simulator', flags: '--simulator' },
  { runnerKey: 'macos_15', platform: 'darwin', arch: 'arm64' },
  { runnerKey: 'macos_15_intel', platform: 'darwin', arch: 'x64' },
  { runnerKey: 'win_2025_x64', platform: 'win32', arch: 'x64' },
]

// A dependency needs its PR build only when the change touched what its binary is built from.
export const NATIVE_INPUT = /(\.(cpp|hpp|c|h)|CMakeLists\.txt|\/cmake\/.*|\/vcpkg(-configuration)?\.json|\/binding\.js|\/exports\.txt|\/symbols[^/]*\.map)$/

export function parseRunnerLabels(yaml) {
  return Object.fromEntries([...yaml.matchAll(/echo "([a-z0-9_]+)=([^"]+)" >> "\$GITHUB_OUTPUT"/g)].map((m) => [m[1], m[2]]))
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
  const meta = { ...project.targets[project.rowsFrom?.[target]]?.metadata, ...project.targets[target]?.metadata }
  const base = { project: project.name, dir: project.root, target, timeout: meta.timeoutMinutes ?? 0, meta }
  const runners = meta.runners ?? project.targets[project.rowsFrom?.[target]]?.metadata?.runners
  // A target with no runners is one job per package, on whatever runner the group picks.
  if (target !== 'build' && !runners) return [{ ...base, platform: '', arch: '', tags: '', flags: '', runner: '' }]
  const keys = target === 'build' ? BUILD_LEGS : runners.map((runnerKey) => ({ runnerKey }))
  return keys.map((leg) => {
    const [platform, arch] = RUNNER_KEYS[leg.runnerKey] ?? []
    const runner = labels[leg.runnerKey]
    if (!runner || !platform) throw new Error(`${project.name} ${target}: unknown runner key ${leg.runnerKey}`)
    return { ...base, platform, arch, tags: '', flags: '', ...leg, runner }
  })
}

// cpp:tests runs on cpp:build's rows, in the same job.
const ROWS_FROM = { 'cpp:tests': 'cpp:build' }

export function select({ graph, affected, targets, labels, gate, changed, pr }) {
  const tagged = Object.values(graph.nodes).filter((n) => n.data.tags?.includes(TAG))
  const chosen = tagged.filter((n) => affected === null || affected.includes(n.name))
  const out = { matrices: {}, projects: [] }
  for (const t of targets) out.matrices[t] = []
  for (const n of chosen) {
    const project = { name: n.name, root: n.data.root, targets: n.data.targets, rowsFrom: ROWS_FROM }
    const dir = n.data.root.split('/').pop()
    const npm = n.data.metadata?.js?.packageName ?? n.name
    const waits = pr ? dependencyWaits(graph, n.name, changed, gate) : []
    const own = targets.filter((t) => n.data.targets[t])
    if (!own.length) continue
    const commands = Object.fromEntries(own.map((t) => [t, { command: n.data.targets[t].options?.command ?? '', cwd: n.data.targets[t].options?.cwd ?? n.data.root }]))
    const provider = nativeProvider(graph, n.name, gate)
    const common = { slug: dir, npm, key: gate[dir] ?? '', provider, waits, targets: own, commands }
    out.projects.push({ name: n.name, dir: n.data.root, ...common, prebuildStatus: PREBUILD_KEYS.includes(gate[dir]), cppStatus: CPP_TEST_KEYS.includes(gate[dir]) })
    for (const t of own) {
      const cmd = n.data.targets[t].options ?? {}
      for (const r of rows(project, t, labels)) out.matrices[t].push({ ...r, ...common, command: cmd.command ?? '', cwd: cmd.cwd ?? n.data.root })
    }
  }
  return out
}

// The npm dependency the gate expects prebuilds from; its platform packages provide the addon's symbols.
export function nativeProvider(graph, name, gate) {
  const dep = (graph.dependencies[name] ?? []).find((d) => d.type === 'static' && graph.nodes[d.target] && PREBUILD_KEYS.includes(gate[graph.nodes[d.target].data.root.split('/').pop()]))
  return dep ? (graph.nodes[dep.target].data.metadata?.js?.packageName ?? dep.target) : ''
}

// An untagged native dependency is not built in this run, so its own producer's output is awaited.
export function dependencyWaits(graph, name, changed, gate) {
  const seen = new Set()
  const stack = [name]
  const waits = []
  while (stack.length) {
    for (const d of graph.dependencies[stack.pop()] ?? []) {
      if (seen.has(d.target)) continue
      seen.add(d.target)
      stack.push(d.target)
      const node = graph.nodes[d.target]
      if (!node || node.data.tags?.includes(TAG)) continue
      const dir = node.data.root.split('/').pop()
      const key = gate[dir]
      if (!PREBUILD_KEYS.includes(key)) continue
      if (!changed.some((f) => f.startsWith(`${node.data.root}/`) && NATIVE_INPUT.test(f.slice(node.data.root.length)))) continue
      waits.push({ key, project: d.target, npm: node.data.metadata?.js?.packageName ?? d.target, artifact: `${dir}-prebuilds` })
    }
  }
  return waits
}

// "desktop=test:integration+test:backend" adds one matrix holding both targets' rows, for targets that share a job.
export function combine(matrices, spec = '') {
  const out = {}
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [name, targets] = part.split('=')
    out[name] = targets.split('+').flatMap((t) => matrices[t] ?? [])
  }
  return out
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()

// The pull request is compared with the point its branch left the base, not the base's tip.
function changedFiles(env, event) {
  const pr = event.pull_request
  const before = event.before && !/^0+$/.test(event.before) ? event.before : ''
  const [base, head] = pr ? [pr.base.sha, pr.head.sha] : [before, env.GITHUB_SHA]
  if (!base) return null
  try {
    git(['fetch', '--no-tags', '--filter=blob:none', 'origin', base])
    try {
      git(['fetch', '--no-tags', '--filter=blob:none', 'origin', head])
    } catch {
      git(['fetch', '--no-tags', '--filter=blob:none', `https://github.com/${pr.head.repo.full_name}.git`, head])
    }
    const mergeBase = git(['merge-base', base, head])
    return git(['diff', '--name-only', mergeBase, head]).split('\n').filter(Boolean)
  } catch (e) {
    console.log(`::warning::could not diff ${base}..${head}, selecting every tagged package: ${e.message}`)
    return null
  }
}

function main(env) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  const targets = env.TARGETS.split(/[\s,]+/).filter(Boolean)
  const tmp = join(env.RUNNER_TEMP, 'nx-graph.json')
  execFileSync('pnpm', ['exec', 'nx', 'graph', `--file=${tmp}`], { stdio: 'inherit' })
  const graph = JSON.parse(readFileSync(tmp, 'utf8')).graph
  const wanted = env.PACKAGES ? env.PACKAGES.split(/[\s,]+/).filter(Boolean) : null
  let changed = wanted ? [] : changedFiles(env, event)
  let affected = null
  if (wanted) affected = Object.values(graph.nodes).filter((n) => wanted.includes(n.name) || wanted.includes(n.data.root.split('/').pop())).map((n) => n.name)
  else if (changed && env.MODE === 'owners') affected = Object.values(graph.nodes).filter((n) => changed.some((f) => f.startsWith(`${n.data.root}/`))).map((n) => n.name)
  else if (changed) affected = JSON.parse(execFileSync('pnpm', ['exec', 'nx', 'show', 'projects', '--affected', `--files=${changed.join(',') || 'none'}`, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  changed ??= []
  const result = select({
    graph, affected, targets, changed, pr: Boolean(event.pull_request),
    labels: parseRunnerLabels(readFileSync('.github/workflows/reusable-runner-names.yml', 'utf8')),
    gate: gateKeys(readFileSync('.github/workflows/pr-gate-merge.yml', 'utf8')),
  })
  Object.assign(result.matrices, combine(result.matrices, env.COMBINE))
  for (const [t, r] of Object.entries(result.matrices)) console.log(`${t}: ${r.map((x) => `${x.project}@${x.platform}-${x.arch}${x.tags}`).join(' ') || 'none'}`)
  appendFileSync(env.GITHUB_OUTPUT, `matrices=${JSON.stringify(result.matrices)}\nprojects=${JSON.stringify(result.projects)}\nany=${result.projects.length > 0}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.env)
