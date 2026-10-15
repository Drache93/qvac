// Contract checks over the group workflows; each returns violations, empty is a pass.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const GROUP_WORKFLOWS = [
  '_select-projects.yml',
  'pr-checks.yml',
  'pr-build-test.yml',
  'mobile-tests.yml',
  'cache-warm.yml',
  'publish-npm.yml',
  'publish-gpr.yml',
]

export const SELECT_WORKFLOW = '_select-projects.yml'
export const ACTION_LINE_CAP = 60

const SELECTION_MARKERS = [/nx-project-matrix/, /\bnx show projects\b/, /\bnx affected\b/, /select-projects\.mjs/]
const FIRST_PARTY_OWNERS = new Set(['tetherto'])

export function groupFiles(root) {
  const dir = join(root, '.github/workflows')
  return GROUP_WORKFLOWS.filter((f) => existsSync(join(dir, f))).map((f) => ({
    name: f,
    path: join(dir, f),
    text: readFileSync(join(dir, f), 'utf8'),
  }))
}

export function packageDirs(root) {
  const dir = join(root, 'packages')
  return readdirSync(dir).filter((e) => statSync(join(dir, e)).isDirectory())
}

export function localActionRefs(text) {
  const names = new Set()
  for (const m of text.matchAll(/uses:\s*['"]?\.\/(?:\.workflow\/)?\.github\/actions\/([A-Za-z0-9._/-]+?)['"]?\s*$/gm)) {
    names.add(m[1].replace(/\/$/, ''))
  }
  return [...names]
}

function actionFile(root, name) {
  for (const f of ['action.yml', 'action.yaml']) {
    const p = join(root, '.github/actions', name, f)
    if (existsSync(p)) return p
  }
  return null
}

function calledActions(root) {
  const seen = new Map()
  for (const g of groupFiles(root)) {
    for (const name of localActionRefs(g.text)) {
      if (!seen.has(name)) seen.set(name, { name, callers: [], file: actionFile(root, name) })
      seen.get(name).callers.push(g.name)
    }
  }
  return [...seen.values()]
}

function actionDirFiles(root, name) {
  const dir = join(root, '.github/actions', name)
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === 'dist') continue
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else out.push(p)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

export function checkActionLineCap(root) {
  const out = []
  for (const a of calledActions(root)) {
    if (!a.file) {
      out.push(`${a.callers.join(', ')} calls missing action ${a.name}`)
      continue
    }
    const lines = readFileSync(a.file, 'utf8').replace(/\n$/, '').split('\n').length
    if (lines > ACTION_LINE_CAP) out.push(`${a.callers.join(', ')} calls ${a.name}: ${lines} lines, cap ${ACTION_LINE_CAP}`)
  }
  return out
}

function packageNamePatterns(pkgs) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return pkgs.flatMap((p) => {
    const n = esc(p)
    const forms = [
      [`packages/${p}`, new RegExp(`packages/${n}(?![A-Za-z0-9_-])`)],
      [`@qvac|@tetherto/${p}`, new RegExp(`@(?:qvac|tetherto)/${n}(?![A-Za-z0-9_-])`)],
    ]
    if (p.includes('-')) forms.push([`"${p}"`, new RegExp(`['"]${n}['"]`)])
    return forms
  })
}

export function checkNoPackageNames(root, pkgs = packageDirs(root)) {
  const patterns = packageNamePatterns(pkgs)
  const sources = groupFiles(root).map((g) => [g.name, g.text])
  for (const a of calledActions(root)) {
    for (const f of actionDirFiles(root, a.name)) {
      if (!/\.test\.[cm]?js$/.test(f)) sources.push([f.slice(root.length + 1), readFileSync(f, 'utf8')])
    }
  }
  const out = []
  for (const [file, text] of sources) {
    for (const [form, re] of patterns) if (re.test(text)) out.push(`${file} names a package (${form})`)
  }
  return out
}

export function checkThirdPartyUses(root) {
  const out = []
  for (const g of groupFiles(root)) {
    const lines = g.text.split('\n')
    lines.forEach((line, i) => {
      const m = line.match(/^(\s*)(-\s+)?uses:\s*['"]?([^'"\s]+)/)
      if (!m) return
      const ref = m[3]
      if (ref.startsWith('./')) return
      const owner = ref.split('/')[0]
      if (FIRST_PARTY_OWNERS.has(owner)) return
      if (ref.startsWith('actions/checkout@') && isFirstStep(lines, i)) return
      out.push(`${g.name}:${i + 1} uses third-party ${ref.split('@')[0]} directly; call its wrapper in .github/actions`)
    })
  }
  const owners = new Map()
  for (const a of calledActions(root)) {
    if (!a.file) continue
    for (const m of readFileSync(a.file, 'utf8').matchAll(/uses:\s*['"]?([^'"\s@]+)@/g)) {
      const ref = m[1]
      if (ref.startsWith('./') || FIRST_PARTY_OWNERS.has(ref.split('/')[0])) continue
      if (!owners.has(ref)) owners.set(ref, new Set())
      owners.get(ref).add(a.name)
    }
  }
  for (const [ref, names] of owners) {
    if (names.size > 1) out.push(`${ref} is pinned in ${names.size} actions (${[...names].join(', ')}); keep it in one wrapper`)
  }
  return out
}

// A step is a job's first when the nearest content line above its dash is `steps:`.
function isFirstStep(lines, i) {
  const usesIndent = lines[i].match(/^(\s*)/)[1].length
  let start = i
  if (!/^\s*-\s/.test(lines[i])) {
    while (start > 0 && !(/^\s*-\s/.test(lines[start]) && lines[start].match(/^(\s*)/)[1].length < usesIndent)) start--
  }
  for (let j = start - 1; j >= 0; j--) {
    const l = lines[j].trim()
    if (!l || l.startsWith('#')) continue
    return l === 'steps:'
  }
  return false
}

export function checkActionTests(root) {
  const out = []
  for (const a of calledActions(root)) {
    const files = actionDirFiles(root, a.name)
    const scripts = files.filter((f) => /\.(mjs|cjs|js)$/.test(f) && !/\.test\.(mjs|cjs|js)$/.test(f))
    const tests = files.filter((f) => /\.test\.(mjs|cjs|js)$/.test(f))
    if (scripts.length && !tests.length) out.push(`${a.name} has a script but no node --test file`)
  }
  return out
}

export function checkSelectionOnce(root) {
  const out = []
  for (const g of groupFiles(root)) {
    if (g.name === SELECT_WORKFLOW) continue
    const calls = [...g.text.matchAll(/uses:\s*\.\/\.github\/workflows\/_select-projects\.yml/g)].length
    if (calls > 1) out.push(`${g.name} calls ${SELECT_WORKFLOW} ${calls} times; select once and pass the outputs`)
    if (SELECTION_MARKERS.some((re) => re.test(g.text))) out.push(`${g.name} runs selection logic itself; use ${SELECT_WORKFLOW}`)
    for (const m of g.text.matchAll(/uses:\s*\.\/\.github\/workflows\/([A-Za-z0-9._-]+)/g)) {
      const callee = m[1]
      if (callee === SELECT_WORKFLOW || callee === 'reusable-fork-approval.yml') continue
      out.push(`${g.name} calls ${callee}; keep the group's work as jobs so nothing recomputes the selection`)
    }
  }
  for (const a of calledActions(root)) {
    if (!a.file) continue
    if (SELECTION_MARKERS.some((re) => re.test(readFileSync(a.file, 'utf8')))) out.push(`${a.name} runs selection logic; only ${SELECT_WORKFLOW} may`)
  }
  return out
}
