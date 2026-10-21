import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BUILD_LEGS, changedFiles, combine, gateKeys, ownersOf, parseRunnerLabels, resolveRange, select } from '../select-projects.mjs'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const labels = parseRunnerLabels(readFileSync(`${root}.github/workflows/reusable-runner-names.yml`, 'utf8'))
const gate = gateKeys(readFileSync(`${root}.github/workflows/pr-gate-merge.yml`, 'utf8'))

const node = (name, root, tags, targets) => ({ name, data: { root, tags, targets, metadata: { js: { packageName: name } } } })
const graph = {
  nodes: {
    '@qvac/vla-ggml': node('@qvac/vla-ggml', 'packages/vla-ggml', ['ci:contract'], {
      build: { options: { command: 'pnpm run build', cwd: 'packages/vla-ggml' } },
      'cpp:build': { options: { command: 'b' }, metadata: { runners: ['linux_ubuntu2404_x64', 'win_2025_x64'] } },
      'cpp:tests': { options: { command: 't' }, metadata: { timeoutMinutes: 60 } },
      'test:integration': { options: { command: 'i' }, metadata: { runners: ['macos_15_large'] } },
    }),
    '@qvac/fabric': node('@qvac/fabric', 'packages/fabric', [], { build: {} }),
    '@qvac/llm-llamacpp': node('@qvac/llm-llamacpp', 'packages/llm-llamacpp', [], { build: {} }),
  },
  dependencies: { '@qvac/vla-ggml': [{ target: '@qvac/fabric', type: 'static' }], '@qvac/fabric': [] },
}
const args = { graph, labels, gate, targets: ['build', 'cpp:build', 'cpp:tests', 'test:integration', 'test:mobile'], changed: [], pr: true }

test('the gate key and runner labels come from the files that own them', () => {
  assert.equal(gate['vla-ggml'], 'vla')
  assert.equal(gate['llm-llamacpp'], 'llm-llamacpp')
  assert.equal(labels.win_2025_x64, 'qvac-win25-x64')
})

test('only tagged, affected packages are selected, with a row per runner', () => {
  const r = select({ ...args, affected: ['@qvac/vla-ggml', '@qvac/llm-llamacpp'] })
  assert.equal(r.projects.length, 1)
  assert.equal(r.matrices.build.length, BUILD_LEGS.length)
  assert.deepEqual(r.matrices['cpp:build'].map((x) => `${x.platform}-${x.arch}@${x.runner}`), ['linux-x64@qvac-ubuntu2404-x64', 'win32-x64@qvac-win25-x64'])
  assert.equal(r.matrices['cpp:tests'].length, 2, 'cpp:tests runs on cpp:build rows')
  assert.equal(r.matrices['cpp:tests'][0].timeout, 60)
  assert.deepEqual(r.matrices['test:mobile'], [], 'not declared, no rows')
  assert.equal(r.matrices['test:integration'][0].command, 'i')
  assert.equal(r.projects[0].key, 'vla')
})

test('an owner target runs only for a package the change touched, the rest follow dependents', () => {
  const dependent = select({ ...args, affected: ['@qvac/vla-ggml'], owners: ['@qvac/fabric'], ownerTargets: ['cpp:build'] })
  assert.deepEqual(dependent.matrices['cpp:build'], [], 'vla only depends on the change')
  assert.equal(dependent.matrices.build.length, BUILD_LEGS.length)
  const owner = select({ ...args, affected: ['@qvac/vla-ggml'], owners: ['@qvac/vla-ggml'], ownerTargets: ['cpp:build'] })
  assert.equal(owner.matrices['cpp:build'].length, 2)
  assert.equal(select({ ...args, affected: null, owners: null, ownerTargets: ['cpp:build'] }).matrices['cpp:build'].length, 2, 'an explicit or unknown change selects every owner target')
})

test('a change touching only untagged packages selects nothing', () => {
  assert.deepEqual(select({ ...args, affected: ['@qvac/llm-llamacpp'] }).projects, [])
})

test('an untagged dependency is awaited only when its native inputs changed on a PR', () => {
  const wait = (changed, pr = true) => select({ ...args, affected: null, changed, pr }).projects[0].waits
  assert.deepEqual(wait(['packages/fabric/src/ggml.cpp']), [{ key: 'fabric', project: '@qvac/fabric', npm: '@qvac/fabric', artifact: 'fabric-prebuilds' }])
  assert.deepEqual(wait(['packages/fabric/vcpkg.json']).length, 1)
  assert.deepEqual(wait(['packages/fabric/README.md']), [])
  assert.deepEqual(wait(['packages/fabric/src/ggml.cpp'], false), [])
})

test('an unknown runner key fails loudly', () => {
  const bad = structuredClone(graph)
  bad.nodes['@qvac/vla-ggml'].data.targets['test:integration'].metadata.runners = ['nope']
  assert.throws(() => select({ ...args, graph: bad, affected: null }), /unknown runner key nope/)
})

test('a target without runners gets one row per package', () => {
  const g = structuredClone(graph)
  g.nodes['@qvac/vla-ggml'].data.targets.lint = { options: { command: 'pnpm run lint', cwd: 'packages/vla-ggml' } }
  const r = select({ ...args, graph: g, targets: ['lint'], affected: null })
  assert.deepEqual(r.matrices.lint.map((x) => [x.project, x.runner, x.command]), [['@qvac/vla-ggml', '', 'pnpm run lint']])
})

test('the native provider is the dependency the gate expects prebuilds from', () => {
  const r = select({ ...args, affected: null })
  assert.equal(r.projects[0].provider, '@qvac/fabric')
  assert.equal(r.projects[0].providerArtifact, 'fabric-prebuilds')
  assert.equal(r.matrices.build[0].slug, 'vla-ggml')
})

test('cpp:tests rows carry cpp:build settings under their own', () => {
  const g = structuredClone(graph)
  g.nodes['@qvac/vla-ggml'].data.targets['cpp:build'].metadata.windowsVsGenerator = true
  const r = select({ ...args, graph: g, affected: null })
  assert.deepEqual([r.matrices['cpp:tests'][1].meta.windowsVsGenerator, r.matrices['cpp:tests'][1].timeout], [true, 60])
})

test('each row carries its own package targets and commands', () => {
  const r = select({ ...args, affected: null })
  assert.equal(r.matrices['cpp:tests'][0].commands['cpp:build'].command, 'b')
  assert.ok(r.matrices['cpp:tests'][0].targets.includes('cpp:build'))
})

test('targets sharing a job get one combined matrix', () => {
  assert.deepEqual(combine({ a: [1], b: [2, 3] }, 'both=a+b'), { both: [1, 2, 3] })
  assert.deepEqual(combine({ a: [1] }, ''), {})
})

const pr = { base: { sha: 'b1' }, head: { sha: 'h1', repo: { full_name: 'fork/qvac' } } }

test('both PR events compare from the common ancestor, so they select the same packages', () => {
  for (const eventName of ['pull_request', 'pull_request_target']) {
    assert.deepEqual(resolveRange({ eventName, event: { pull_request: pr }, defaultBranch: 'main' }), { base: 'b1', head: 'h1', mergeBase: true, headRepo: 'fork/qvac' })
  }
})

test('a push compares with the tip before it, and a new branch with where it was cut', () => {
  assert.deepEqual(resolveRange({ eventName: 'push', event: { before: 'p0', after: 'p1' }, defaultBranch: 'main' }), { base: 'p0', head: 'p1' })
  assert.deepEqual(resolveRange({ eventName: 'push', event: { before: '0'.repeat(40), after: 'p1' }, defaultBranch: 'main' }), { base: 'origin/main', head: 'p1', mergeBase: true })
})

test('a dispatch names its packages, or compares a branch with main, and main itself selects everything', () => {
  assert.deepEqual(resolveRange({ eventName: 'workflow_dispatch', event: {}, packages: ['vla-ggml'] }), { explicit: ['vla-ggml'] })
  assert.deepEqual(resolveRange({ eventName: 'workflow_dispatch', event: {}, defaultBranch: 'main', ref: 'refs/heads/feature-x', sha: 's' }), { base: 'origin/main', head: 's', mergeBase: true })
  assert.deepEqual(resolveRange({ eventName: 'workflow_dispatch', event: {}, defaultBranch: 'main', ref: 'refs/heads/main', sha: 's' }), { all: true })
  assert.deepEqual(resolveRange({ eventName: 'schedule', event: {} }), { all: true })
})

test('the diff fetches commits and trees only, falls back to the fork for its head, and lists a move under both paths', () => {
  const calls = []
  const run = (args) => {
    calls.push(args.join(' '))
    if (args[0] === 'fetch' && args[4] === 'h1' && args[3] === 'origin') throw new Error('not on origin')
    if (args[0] === 'merge-base') return 'mb'
    if (args[0] === 'diff') return 'packages/a/x.c\npackages/b/x.c\n'
    return ''
  }
  assert.deepEqual(changedFiles({ base: 'b1', head: 'h1', mergeBase: true, headRepo: 'fork/qvac' }, run), ['packages/a/x.c', 'packages/b/x.c'])
  assert.ok(calls.includes('fetch --no-tags --filter=blob:none https://github.com/fork/qvac.git h1'))
  assert.ok(calls.includes('diff --name-only --no-renames mb h1'))
  assert.ok(!calls.some((c) => c.includes('origin/main')), 'a branch already on the checkout is not fetched')
})

test('a changed path belongs to the package whose root holds it', () => {
  const g = { nodes: { a: { name: 'a', data: { root: 'packages/a' } }, ab: { name: 'ab', data: { root: 'packages/ab' } } } }
  assert.deepEqual(ownersOf(g, ['packages/a/x.c', 'docs/y.md']), ['a'])
})
