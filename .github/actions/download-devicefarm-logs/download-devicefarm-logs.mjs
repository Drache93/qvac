#!/usr/bin/env node
// Downloads the logs worth keeping from Device Farm runs and copies them, credentials scrubbed, to an upload dir.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

// Videos, screenshots and TCP dumps (up to 600 MB) are skipped; the console links still reach them.
export const wanted = (a, platform) =>
  /customer.*artifact|logcat|test.*spec.*output|standard.*output/i.test(a.name) && !(platform === 'Android' && a.extension === 'mp4')
export const safe = (s) => String(s).replace(/[ /]/g, '_').replace(/[^A-Za-z0-9_.-]/g, '')

// The phone's console, results and native crash reports live inside Customer_Artifacts.zip.
const FROM_ZIP = [[/^bare_console\.log$/, 'bare_console.log'], [/^appium\.log$/, 'appium.log'], [/^test-results\.json$/, 'test-results.json'], [/^logcat_full\.txt$/, 'logcat_full.txt']]

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map((f) => join(dir, String(f))) : [])
const files = (dir) => walk(dir).filter((f) => statSync(f).isFile())

export function extract(logDir, outDir) {
  mkdirSync(outDir, { recursive: true })
  for (const f of walk(logDir)) {
    const name = basename(f)
    const device = relative(logDir, f).split(/[/\\]/)[0]
    if (f.includes('_unpacked/')) continue
    if (statSync(f).isFile() && /Logcat\.|test.*spec.*output|standard.*output/i.test(name)) copyFileSync(f, join(outDir, `${device}_${name}`))
    if (!name.endsWith('Customer_Artifacts_unpacked')) continue
    const inside = files(f)
    for (const [re, as] of FROM_ZIP) {
      const hit = inside.find((x) => re.test(basename(x)))
      if (hit) copyFileSync(hit, join(outDir, `${device}_${as}`))
    }
    for (const crash of inside.filter((x) => basename(dirname(x)) === 'crash-reports' && basename(x).startsWith('QvacAddonTester'))) {
      copyFileSync(crash, join(outDir, `${device}_crash_${basename(crash)}`))
    }
  }
}

// The repo is public, and runner masking does not reach uploaded files.
export function scrub(dir) {
  let n = 0
  for (const f of files(dir)) {
    const text = readFileSync(f, 'utf8')
    const out = text.replace(/X-Amz-(Signature|Credential|Security-Token)=[^&\s"<>]+/gi, (_, k) => `X-Amz-${k}=REDACTED`)
    if (out !== text) writeFileSync(f, out), n++
  }
  return n
}

async function download(env) {
  const aws = (args) => { try { return JSON.parse(execFileSync('aws', ['devicefarm', ...args, '--output', 'json'], { encoding: 'utf8' })) } catch { return {} } }
  const get = async (a, dir) => {
    if (!a.url || !wanted(a, env.PLATFORM)) return
    mkdirSync(dir, { recursive: true })
    const res = await fetch(a.url, { signal: AbortSignal.timeout(300_000) }).catch(() => null)
    if (res?.ok) writeFileSync(join(dir, `${safe(a.name)}.${a.extension}`), Buffer.from(await res.arrayBuffer()))
  }
  for (const runArn of JSON.parse(env.RUN_ARNS || '[]')) {
    const run = safe(aws(['get-run', '--arn', runArn]).run?.name || 'unknown')
    for (const job of aws(['list-jobs', '--arn', runArn]).jobs || []) {
      const jobDir = join(env.LOG_DIR, `${run}_${safe(job.device?.name || 'unknown')}`)
      for (const suite of aws(['list-suites', '--arn', job.arn]).suites || []) {
        if (['Setup Test', 'Teardown Test'].includes(suite.name)) continue
        for (const type of ['FILE', 'LOG']) for (const a of aws(['list-artifacts', '--arn', suite.arn, '--type', type]).artifacts || []) await get(a, join(jobDir, safe(suite.name)))
      }
      for (const a of aws(['list-artifacts', '--arn', job.arn, '--type', 'FILE']).artifacts || []) await get(a, jobDir)
    }
  }
  for (const zip of walk(env.LOG_DIR).filter((f) => f.endsWith('Customer_Artifacts.zip'))) {
    try { execFileSync('unzip', ['-qo', zip, '-d', zip.replace(/\.zip$/, '_unpacked')]) } catch { console.log(`::warning::could not unzip ${zip}`) }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await download(process.env)
  extract(process.env.LOG_DIR, process.env.CONSOLE_DIR)
  console.log(`Redacted presigned credentials in ${scrub(process.env.CONSOLE_DIR)} file(s)`)
}
