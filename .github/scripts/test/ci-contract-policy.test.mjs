import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkActionLineCap,
  checkActionTests,
  checkNoNestedLocalActions,
  checkNoPackageNames,
  checkSelectionOnce,
  checkWorkflowSize,
  checkThirdPartyUses,
} from '../lib/ci-contract.mjs'

const root = fileURLToPath(new URL('../../..', import.meta.url))

function fixture({ workflows = {}, actions = {}, packages = ['vla-ggml', 'error'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-contract-'))
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  for (const p of packages) mkdirSync(join(dir, 'packages', p), { recursive: true })
  for (const [name, text] of Object.entries(workflows)) put(`.github/workflows/${name}`, text)
  for (const [name, files] of Object.entries(actions)) {
    for (const [rel, text] of Object.entries(files)) put(`.github/actions/${name}/${rel}`, text)
  }
  return dir
}

const lines = (n) => Array.from({ length: n }, (_, i) => `# ${i}`).join('\n') + '\n'

const job = (steps) => `jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`

test('an action a group calls may be 60 lines but not 61', () => {
  const at = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(60) } },
  })
  assert.deepEqual(checkActionLineCap(at), [])
  const over = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(61) } },
  })
  assert.match(checkActionLineCap(over)[0], /lean: 61 lines, cap 60/)
})

test('old actions only the old path calls are not held to the cap', () => {
  const dir = fixture({
    workflows: { 'on-pr-legacy.yml': job('      - uses: ./.github/actions/big\n') },
    actions: { big: { 'action.yml': lines(700) } },
  })
  assert.deepEqual(checkActionLineCap(dir), [])
})

test('actions loaded from the trusted ./.workflow/ copy count as called', () => {
  const dir = fixture({
    workflows: { 'pr-build-test.yml': job('      - uses: ./.workflow/.github/actions/big\n') },
    actions: { big: { 'action.yml': lines(61) } },
  })
  assert.equal(checkActionLineCap(dir).length, 1)
})

test('a group or a called action that names a package fails', () => {
  const inGroup = fixture({ workflows: { 'pr-build-test.yml': job('      - run: cd packages/vla-ggml\n') } })
  assert.match(checkNoPackageNames(inGroup)[0], /pr-build-test\.yml names a package \(packages\/vla-ggml\)/)
  const inAction = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(3), 'index.mjs': "if (pkg === 'vla-ggml') skip()\n" } },
  })
  assert.match(checkNoPackageNames(inAction)[0], /index\.mjs names a package/)
  const npm = fixture({ workflows: { 'cache-warm.yml': job('      - run: npm view @qvac/error\n') } })
  assert.equal(checkNoPackageNames(npm).length, 1)
})

test('test files may use real package names as fixtures', () => {
  const dir = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(3), 'lean.test.mjs': "const w = 'packages/vla-ggml'\n" } },
  })
  assert.deepEqual(checkNoPackageNames(dir), [])
})

test('plain words that happen to be package names do not trip the check', () => {
  const dir = fixture({ workflows: { 'pr-checks.yml': job('      - run: echo "error" && exit 1\n') } })
  assert.deepEqual(checkNoPackageNames(dir), [])
})

test('a third-party action is allowed only as a job\'s first-step checkout', () => {
  const ok = fixture({
    workflows: {
      'pr-checks.yml': job('      - uses: actions/checkout@0123 # 6.0.2\n      - uses: ./.github/actions/setup-node\n'),
    },
  })
  assert.deepEqual(checkThirdPartyUses(ok), [])
  const cache = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: actions/checkout@0123\n      - uses: actions/cache@4567\n') },
  })
  assert.match(checkThirdPartyUses(cache)[0], /uses third-party actions\/cache directly/)
  const lateCheckout = fixture({
    workflows: { 'pr-checks.yml': job('      - run: echo hi\n      - uses: actions/checkout@0123\n') },
  })
  assert.equal(checkThirdPartyUses(lateCheckout).length, 1)
  const named = fixture({
    workflows: { 'pr-checks.yml': job('      - name: Checkout\n        uses: actions/checkout@0123\n') },
  })
  assert.deepEqual(checkThirdPartyUses(named), [])
})

test('a third-party action pinned in two called actions fails', () => {
  const dir = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/a\n      - uses: ./.github/actions/b\n') },
    actions: {
      a: { 'action.yml': 'runs:\n  steps:\n    - uses: actions/cache@0123\n' },
      b: { 'action.yml': 'runs:\n  steps:\n    - uses: actions/cache@0123\n' },
    },
  })
  assert.match(checkThirdPartyUses(dir)[0], /actions\/cache is pinned in 2 actions/)
})

test('a called action with a script needs a node --test file', () => {
  const missing = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(3), 'index.mjs': 'export {}\n' } },
  })
  assert.match(checkActionTests(missing)[0], /lean has a script but no node --test file/)
  const tested = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/lean\n') },
    actions: { lean: { 'action.yml': lines(3), 'index.mjs': 'export {}\n', 'test/index.test.mjs': '' } },
  })
  assert.deepEqual(checkActionTests(tested), [])
})

test('a group selects once and never recomputes the selection', () => {
  const twice = fixture({
    workflows: {
      'pr-build-test.yml':
        'jobs:\n  a:\n    uses: ./.github/workflows/_select-projects.yml\n  b:\n    uses: ./.github/workflows/_select-projects.yml\n',
    },
  })
  assert.match(checkSelectionOnce(twice)[0], /calls _select-projects\.yml 2 times/)
  const inline = fixture({ workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/nx-project-matrix\n') } })
  assert.ok(checkSelectionOnce(inline).some((v) => /runs selection logic itself/.test(v)))
  const leaf = fixture({ workflows: { 'pr-build-test.yml': 'jobs:\n  t:\n    uses: ./.github/workflows/cpp-tests-nx.yml\n' } })
  assert.match(checkSelectionOnce(leaf)[0], /calls cpp-tests-nx\.yml/)
  const ok = fixture({
    workflows: {
      'pr-build-test.yml':
        'jobs:\n  select:\n    uses: ./.github/workflows/_select-projects.yml\n  approve:\n    uses: ./.github/workflows/reusable-fork-approval.yml\n  build:\n    uses: ./.github/workflows/_build.yml\n',
      '_select-projects.yml': job('      - run: npx nx show projects --affected\n'),
    },
  })
  assert.deepEqual(checkSelectionOnce(ok), [])
})

test('a group workflow is at most 400 lines', () => {
  const big = fixture({ workflows: { 'pr-checks.yml': 'x\n'.repeat(401) } })
  assert.match(checkWorkflowSize(big)[0], /pr-checks\.yml is 401 lines/)
  assert.deepEqual(checkWorkflowSize(fixture({ workflows: { 'pr-checks.yml': 'x\n'.repeat(400) } })), [])
})

test('an action the groups call may not call a local action', () => {
  const dir = fixture({
    workflows: { 'pr-checks.yml': job('      - uses: ./.github/actions/outer\n') },
    actions: { outer: { 'action.yml': 'runs:\n  steps:\n    - uses: ./.github/actions/inner\n' } },
  })
  assert.match(checkNoNestedLocalActions(dir)[0], /outer calls a local action/)
})

test('the repository passes every contract check', () => {
  assert.deepEqual(checkActionLineCap(root), [])
  assert.deepEqual(checkNoPackageNames(root), [])
  assert.deepEqual(checkThirdPartyUses(root), [])
  assert.deepEqual(checkActionTests(root), [])
  assert.deepEqual(checkSelectionOnce(root), [])
  assert.deepEqual(checkNoNestedLocalActions(root), [])
  assert.deepEqual(checkWorkflowSize(root), [])
})
