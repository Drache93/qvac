import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const url =
  'https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/resolve/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf'
const expected = '57a1085840f497d764a7fc5d346922dbde961efb54cc792ea81d694fd846a1d8'
const directory = new URL('../artifacts/models/', import.meta.url)
await mkdir(directory, { recursive: true })
const target = fileURLToPath(new URL('Qwen3.5-2B-Q4_K_M.gguf', directory))
if (!existsSync(target)) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${target}.partial`))
  await rename(`${target}.partial`, target)
}
const hash = createHash('sha256')
for await (const chunk of createReadStream(target)) hash.update(chunk)
const actual = hash.digest('hex')
if (actual !== expected) {
  await rm(target)
  throw new Error(`GGUF checksum mismatch: ${actual}`)
}
console.log(JSON.stringify({ path: target, sha256: actual, url }))
