import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BUILD_LEGS, combine, gateKeys, parseRunnerLabels, select } from '../select-projects.mjs'

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
