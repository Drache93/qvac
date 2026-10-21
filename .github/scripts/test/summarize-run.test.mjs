import test from 'node:test'
import assert from 'node:assert/strict'

import { classify, summarize } from '../summarize-run.mjs'

const job = (name, conclusion, steps = []) => ({ name, status: 'completed', conclusion, steps, html_url: `https://x/${encodeURIComponent(name)}` })

test('a job name splits into stage, package and leg', () => {
  assert.deepEqual(classify('build / vla-ggml win32-x64', ['vla-ggml']), { stage: 'build', pkg: 'vla-ggml', leg: 'win32-x64' })
  assert.deepEqual(classify('status vla-ggml', ['vla-ggml']), { stage: 'status', pkg: 'vla-ggml', leg: '' })
  assert.deepEqual(classify('cpp-lint / vla-ggml', ['vla-ggml']), { stage: 'cpp-lint', pkg: 'vla-ggml', leg: '' })
  assert.deepEqual(classify('select / select', ['vla-ggml']), { stage: 'select', pkg: '', leg: 'select' })
  assert.equal(classify('build / vla-ggml-extra linux-x64', ['vla-ggml', 'vla-ggml-extra']).pkg, 'vla-ggml-extra', 'longest slug wins')
})

test('the table has a row per package, counts per stage, and lists every failed leg with its step', () => {
  const jobs = [
    job('select / select', 'success'),
    job('build / vla-ggml linux-x64', 'success'),
    job('build / vla-ggml win32-x64', 'failure', [{ name: 'Checkout', conclusion: 'success' }, { name: 'Run ./.github/actions/check-windows-runtime', conclusion: 'failure' }]),
    job('cpp-lint / vla-ggml', 'success'),
    job('desktop / ${{ matrix.row.slug }}', 'skipped'),
    job('status vla-ggml', 'success'),
    job('summary', 'failure'),
  ]
  const { markdown, failed } = summarize({ jobs, slugs: ['vla-ggml'], title: 'PR build and test' })
  assert.equal(failed, 1)
  assert.match(markdown, /\| Package \| build \| cpp-lint \| status \|/)
  assert.match(markdown, /\| vla-ggml \| ❌ 1\/2 \| ✅ \| ✅ \|/)
  assert.match(markdown, /\| vla-ggml \| build \| win32-x64 \| Run \.\/\.github\/actions\/check-windows-runtime \| \[logs\]/)
  assert.doesNotMatch(markdown, /\$\{\{/)
  assert.match(markdown, /Setup: select ✅/)
})

test('an all-green run fails nothing and shows counts', () => {
  const { markdown, failed } = summarize({ jobs: [job('build / a x', 'success'), job('build / a y', 'success')], slugs: ['a'], title: 'T' })
  assert.equal(failed, 0)
  assert.match(markdown, /\| a \| ✅ 2\/2 \|/)
  assert.doesNotMatch(markdown, /### Failed/)
})
