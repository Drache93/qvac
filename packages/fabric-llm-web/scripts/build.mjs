import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const argument of process.argv.slice(2)) {
  if (!['--compat', '--fetch-only'].includes(argument))
    throw new Error(
      `Unsupported build option: ${argument}; this package builds wasm32/Asyncify`
    )
}
const lock = JSON.parse(readFileSync(join(root, 'source-lock.json'), 'utf8'))
const scratch = join(root, '.build')
mkdirSync(scratch, { recursive: true })

function verifyFile(path, expected) {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (digest !== expected) throw new Error(`SHA256 mismatch: ${path}`)
}

async function download(source, name) {
  const path = join(scratch, name)
  if (!existsSync(path)) {
    const response = await fetch(source.url)
    if (!response.ok)
      throw new Error(`Download failed: ${response.status} ${source.url}`)
    writeFileSync(path, Buffer.from(await response.arrayBuffer()))
  }
  verifyFile(path, source.sha256)
  return path
}

const fabricArchive = await download(lock.fabric, 'fabric.tar.gz')
for (const patch of lock.fabric.patches)
  verifyFile(join(root, patch.path), patch.sha256)
const patchSet = createHash('sha256')
  .update(JSON.stringify(lock.fabric.patches))
  .digest('hex')
  .slice(0, 16)
const fabric = join(scratch, `fabric-${lock.fabric.commit}-${patchSet}`)
if (!existsSync(fabric)) {
  mkdirSync(fabric, { recursive: true })
  execFileSync(
    'tar',
    ['-xzf', fabricArchive, '--strip-components=1', '-C', fabric],
    {
      stdio: 'inherit'
    }
  )
  for (const patch of lock.fabric.patches) {
    execFileSync(
      'patch',
      ['-p1', '--batch', '--fuzz=0', '--input', join(root, patch.path)],
      {
        cwd: fabric,
        stdio: 'inherit'
      }
    )
  }
}
for (const patch of lock.fabric.patches) {
  verifyFile(join(fabric, patch.target), patch.patchedSha256)
}
const dawnArchive = await download(lock.dawn, 'dawn.zip')
const dawn = join(scratch, 'emdawnwebgpu_pkg')
if (!existsSync(dawn))
  execFileSync('unzip', ['-q', '-o', dawnArchive, '-d', scratch], {
    stdio: 'inherit'
  })
const output = join(root, 'dist/wasm-compat')
const licenses = join(output, 'licenses')
mkdirSync(licenses, { recursive: true })
copyFileSync(join(fabric, 'LICENSE'), join(licenses, 'fabric.txt'))
cpSync(join(fabric, 'licenses'), join(licenses, 'fabric-third-party'), {
  recursive: true
})
copyFileSync(
  join(fabric, 'vendor/cpp-httplib/LICENSE'),
  join(licenses, 'cpp-httplib.txt')
)
copyFileSync(
  join(dawn, 'webgpu/src/LICENSE'),
  join(licenses, 'dawn-webgpu.txt')
)
copyFileSync(
  join(dawn, 'webgpu_cpp/LICENSE'),
  join(licenses, 'dawn-webgpu-cpp.txt')
)
if (process.argv.includes('--fetch-only')) process.exit(0)

const compilerVersion = execFileSync('emcc', ['--version'], {
  encoding: 'utf8'
})
if (!compilerVersion.includes(` ${lock.emscripten.version} `)) {
  throw new Error(
    `Expected Emscripten ${lock.emscripten.version}, got ${compilerVersion.split('\n')[0]}`
  )
}
const build = join(scratch, 'cmake-compat')
execFileSync(
  'emcmake',
  [
    'cmake',
    '-S',
    root,
    '-B',
    build,
    '-G',
    'Ninja',
    '-DCMAKE_BUILD_TYPE=Release',
    `-DFABRIC_SOURCE_DIR=${fabric}`,
    `-DEMDAWNWEBGPU_DIR=${dawn}`
  ],
  { stdio: 'inherit' }
)
const jobs = process.env.QVAC_BUILD_JOBS ?? '4'
if (!/^[1-9]\d*$/.test(jobs))
  throw new Error('QVAC_BUILD_JOBS must be a positive integer')
execFileSync(
  'cmake',
  ['--build', build, '--target', 'fabric-llm', '--parallel', jobs],
  {
    stdio: 'inherit'
  }
)
writeFileSync(
  join(output, 'build-manifest.json'),
  `${JSON.stringify(
    {
      ...lock,
      profile: 'compat',
      compiler: compilerVersion.split('\n')[0],
      memory64: false,
      asyncMode: 'asyncify',
      modelFilesystem: 'workerfs',
      bridgeSha256: createHash('sha256')
        .update(readFileSync(join(root, 'native/bridge.cpp')))
        .digest('hex'),
      wasmSha256: createHash('sha256')
        .update(readFileSync(join(output, 'fabric-llm.wasm')))
        .digest('hex')
    },
    null,
    2
  )}\n`
)
