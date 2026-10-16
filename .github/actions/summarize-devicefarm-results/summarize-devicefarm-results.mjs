#!/usr/bin/env node
// Tabulates runner and test() results per device from the downloaded console logs.

import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Dynamic counts in a name would split one test across devices.
export function normalize(name) {
  let n = name.replace(/\(\d+\)/g, '(N)').replace(/\b\d{2,}\b/g, 'N')
  for (const m of ['. Found ', '. Full output', ': "', ', got "']) {
    const i = n.indexOf(m)
    if (i > 0) { n = n.slice(0, i); break }
  }
  return n.trim()
}

export const device = (file) => (file.replace(/\.[^.]+$/, '').match(/((?:Apple|Google|Samsung)[_ ][\w ]+?)_(?:bare_console|test-results|logcat_full|appium|Logcat)/) || [])[1]?.replace(/_/g, ' ').trim()

export function parseTap(text) {
  const seen = new Map()
  for (const line of text.split('\n')) {
    const m = line.match(/((?:not )?ok) (\d+) - (.+)/)
    if (!m) continue
    let name = m[3].trim().replace(/['"]+$/, '')
    let status = m[1] === 'ok' ? 'passed' : 'failed'
    let timeMs = null
    if (name.includes('# SKIP')) [status, name] = ['skipped', name.split('# SKIP')[0]]
    else if (name.includes('# time =')) [timeMs, name] = [Math.round(Number((name.match(/# time = ([\d.]+)ms/) || [])[1])) || null, name.split('# time')[0]]
    else if (status === 'failed') name = name.split(':')[0]
    name = normalize(name)
    if (!seen.has(name)) seen.set(name, { status, timeMs })
  }
  return seen
}

export function collect(dir, files = readdirSync(dir)) {
  const runners = {}
  const cases = {}
  const devices = new Set()
  for (const f of files.filter((f) => f.endsWith('_test-results.json'))) {
    const dev = device(f)
    if (!dev) continue
    devices.add(dev)
    let tests = []
    try { tests = JSON.parse(readFileSync(join(dir, f), 'utf8')).tests || [] } catch {}
    for (const t of tests) {
      // A runner that "passed" in under half a second skipped itself.
      const status = t.status === 'passed' && (t.duration || 0) < 500 ? 'skipped' : t.status || 'unknown'
      ;(runners[t.title || '?'] ||= {})[dev] = { status, durationMs: t.duration || 0 }
    }
  }
  for (const f of files.filter((f) => /_(logcat_full\.txt|bare_console\.log)$/.test(f))) {
    const dev = device(f)
    if (!dev) continue
    devices.add(dev)
    for (const [name, r] of parseTap(readFileSync(join(dir, f), 'utf8'))) (cases[name] ||= {})[dev] ??= r
  }
  return { devices: [...devices].sort(), runners, cases }
}

const esc = (t) => t.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, "'")
const ICON = { passed: '✅', failed: '❌', skipped: '⏭️' }
const cell = (r, ms) => (r ? `${ICON[r.status] || '–'}${r.status !== 'skipped' && ms ? ` ${Math.floor(ms / 1000)}s` : ''}` : '–')

export function markdown({ devices, runners, cases }, title) {
  const head = (cols) => [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`]
  const out = []
  if (Object.keys(runners).length) {
    out.push(`### ${title} runners`, '', ...head(['Runner', ...devices]))
    for (const t of Object.keys(runners).sort()) out.push(`| ${esc(t)} | ${devices.map((d) => cell(runners[t][d], runners[t][d]?.durationMs)).join(' | ')} |`)
    out.push('')
  }
  const names = Object.keys(cases).sort()
  if (names.length) {
    out.push(`<details><summary>${title} test cases (${names.length} tests)</summary>`, '', ...head(['#', 'Test', ...devices]))
    names.forEach((n, i) => out.push(`| ${i + 1} | ${esc(n)} | ${devices.map((d) => cell(cases[n][d], cases[n][d]?.timeMs)).join(' | ')} |`))
    out.push('', '</details>', '')
  }
  return out.join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env
  const c = collect(env.CONSOLE_DIR)
  writeFileSync(join(env.CONSOLE_DIR, 'test-case-details.json'), JSON.stringify({
    addon: env.NPM_NAME, platform: env.PLATFORM, devices: c.devices,
    runners: Object.keys(c.runners).sort().map((runner) => ({ runner, results: c.runners[runner] })),
    testCases: Object.keys(c.cases).sort().map((test) => ({ test, results: c.cases[test] })),
  }, null, 2))
  appendFileSync(env.GITHUB_STEP_SUMMARY, markdown(c, `${env.NPM_NAME} — ${env.PLATFORM}`))
}
