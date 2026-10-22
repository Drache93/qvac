#!/usr/bin/env node
// Runs clang-tidy, warnings as errors, on the package's changed sources that are in its compile database.

import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SOURCE = /\.(c|cc|cpp|cxx)$/

export function selectFiles(changed, translationUnits) {
  const tus = new Set(translationUnits)
  return changed.filter((f) => SOURCE.test(f) && tus.has(f))
}

// The helper prints `clang-tidy -p <dir> ... --header-filter='<re>'`.
export function parseBaseCommand(cmd) {
  return {
    buildDir: (cmd.match(/^clang-tidy -p (\S+)/) || [])[1],
    headerFilter: (cmd.match(/--header-filter='([^']+)'/) || [])[1]
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()
  const changed = out('git', [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    '--relative',
    process.env.BASE,
    'HEAD',
    '--',
    '.'
  ])
    .split('\n')
    .filter(Boolean)
  if (!changed.some((f) => SOURCE.test(f)))
    process.exit(console.log('No C/C++ sources changed in this package; skipping clang-tidy.') ?? 0)
  const helper = readdirSync('build', { recursive: true })
    .map(String)
    .find((f) => f.endsWith('clang-tidy-helper.py'))
  if (!helper) throw new Error('clang-tidy-helper.py not found in build/')
  const tool = join('build', helper)
  const files = selectFiles(
    changed,
    out(tool, ['build/compile_commands.json', '--files']).split('\n')
  )
  if (!files.length)
    process.exit(
      console.log('Changed sources are not in compile_commands.json; skipping clang-tidy.') ?? 0
    )
  const { buildDir, headerFilter } = parseBaseCommand(
    out(tool, ['build/compile_commands.json', '--clang-tidy-cmd'])
  )
  console.log(`Linting ${files.length} changed file(s):\n  ${files.join('\n  ')}`)
  const r = spawnSync(
    'clang-tidy',
    ['-p', buildDir, ...files, `--header-filter=${headerFilter}`, '--warnings-as-errors=*'],
    { stdio: 'inherit' }
  )
  if (r.status !== 0) {
    console.log('::error title=Static analysis failed::clang-tidy found issues.')
    process.exit(1)
  }
}
