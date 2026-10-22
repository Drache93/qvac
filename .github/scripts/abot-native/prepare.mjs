import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const [workdirArg, bare, outputArg] = process.argv.slice(2)
assert(workdirArg && bare && outputArg, 'Expected workdir, Bare executable and output directory')
const workdir = path.resolve(workdirArg)
const output = path.resolve(outputArg)
fs.mkdirSync(output, { recursive: true })
const original = fs.readFileSync(path.join(workdir, 'test/integration/abot-world.test.js'), 'utf8')
function replaceOnce(source, old, next) {
  assert.equal(source.split(old).length - 1, 1, `Pinned test changed: ${old}`)
  return source.replace(old, next)
}
let selected = replaceOnce(
  original,
  "const test = require('brittle')",
  `const brittle = require('brittle')
const test = (name, ...args) => {
  if (/^ABot-World: (CPU streaming, KV (off|on)|disk residency, KV on) matches resident frames across history updates$/.test(name)) return brittle(name, ...args)
}`
)
assert.equal(selected.split("config: { backend: 'gpu'").length - 1, 3)
selected = selected.replaceAll("config: { backend: 'gpu'", "config: { backend: 'cuda0'")
selected = replaceOnce(
  selected,
  '  return files\n}',
  `  fs.writeFileSync(proc.env.ABOT_NATIVE_INPUTS, JSON.stringify(files))
  return files
}`
)
const testFile = path.join(workdir, 'test/integration/abot-native-preparation.test.js')
fs.writeFileSync(testFile, selected)
fs.writeFileSync(path.join(output, 'selected-addon-test.js'), selected)
const child = spawnSync(bare, [testFile, '--exit'], {
  cwd: workdir,
  env: {
    ...process.env,
    CI: 'true',
    NO_GPU: 'false',
    ABOT_NATIVE_INPUTS: path.join(output, 'inputs.json')
  },
  encoding: 'utf8',
  timeout: 2_400_000,
  maxBuffer: 32 * 1024 * 1024
})
const log = (child.stdout || '') + (child.stderr || '')
fs.writeFileSync(path.join(output, 'original-addon.log'), log)
process.stdout.write(log)
const passed =
  child.status === 0 &&
  /^# tests = 3\/3 pass$/m.test(log) &&
  /^# asserts = 181\/181 pass$/m.test(log) &&
  log.includes('runtime=CUDA0, params=disk') &&
  log.includes('runtime=CUDA0, params=CPU') &&
  log.includes('runtime=CUDA0, params=CUDA0')
fs.writeFileSync(
  path.join(output, 'original-addon-result.json'),
  JSON.stringify(
    {
      passed,
      status: child.status,
      error: child.error?.message
    },
    null,
    2
  ) + '\n'
)
if (!passed) process.exitCode = 1
