import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageDir = fileURLToPath(new URL('../', import.meta.url))
const root = path.resolve(packageDir, '../..')
const sdkDir = path.join(root, 'packages/sdk')
const require = createRequire(path.join(sdkDir, 'package.json'))
const esbuildModule = process.env.QVAC_ESBUILD_MODULE ?? process.env.ESBUILD_MODULE
const { build } = await import(
  esbuildModule
    ? pathToFileURL(path.resolve(esbuildModule)).href
    : pathToFileURL(require.resolve('esbuild')).href
)
const distDir = path.join(packageDir, 'dist')
await mkdir(distDir, { recursive: true })
const sdkBrowserEntry = path.join(sdkDir, 'dist/src/browser/index.js')

const workspaceEntries = {
  '@qvac/inference/surface': 'inference/src/surface.ts',
  '@qvac/error': 'error/src/index.ts',
  '@qvac/logging': 'logging/src/index.ts',
  '@qvac/logging/constants': 'logging/src/constants.ts',
  '@qvac/rag/errors': 'rag/src/errors.ts'
}
const sourcePlugin = {
  name: 'qvac-workspace-sources',
  setup(builder) {
    builder.onResolve({ filter: /^@qvac\// }, ({ path: specifier }) => {
      const entry = workspaceEntries[specifier]
      if (entry) return { path: path.join(root, 'packages', entry) }
    })
    builder.onResolve({ filter: /^#env$/ }, ({ importer }) => {
      if (importer.startsWith(path.join(root, 'packages/logging/'))) {
        return { path: path.join(root, 'packages/logging/src/env.ts') }
      }
    })
    builder.onResolve({ filter: /^@\// }, ({ path: specifier, importer }) => {
      const owner = importer.startsWith(path.join(root, 'packages/inference/'))
        ? 'inference'
        : 'sdk'
      const base = path.join(root, 'packages', owner, 'src', specifier.slice(2))
      return {
        path: existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts')
      }
    })
  }
}
const options = {
  absWorkingDir: root,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  nodePaths: [path.join(sdkDir, 'node_modules'), path.join(root, 'node_modules')],
  plugins: [sourcePlugin]
}

const result = await build({
  ...options,
  entryPoints: [path.join(sdkDir, 'src/browser/index.ts')],
  outfile: sdkBrowserEntry,
  platform: 'browser',
  metafile: true
})
const inputs = Object.keys(result.metafile.inputs)
const forbidden = inputs.filter((input) =>
  /(?:rpc-client|node-rpc-client|bare-client|bare-runtime|llm-llamacpp|\/worker\/index)\b/.test(
    input
  )
)
const outputImports = Object.values(result.metafile.outputs).flatMap((output) => output.imports)
if (forbidden.length || outputImports.length) {
  throw new Error(
    `Browser bundle contains native or external dependencies: ${JSON.stringify({ forbidden, outputImports })}`
  )
}
await writeFile(
  path.join(distDir, 'bundle-inputs.json'),
  `${JSON.stringify(result.metafile, null, 2)}\n`
)
console.log(
  `Browser SDK bundled from ${inputs.length} inputs; no native transport or external imports`
)

// This tarball proves the browser export only; it is not a full SDK release build.
const artifactsDir = path.join(packageDir, 'artifacts')
await mkdir(artifactsDir, { recursive: true })
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packed = JSON.parse(
  execFileSync(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', artifactsDir], {
    cwd: sdkDir,
    encoding: 'utf8'
  })
)[0]
if (!packed.files.some((file) => file.path === 'dist/src/browser/index.js')) {
  throw new Error('SDK tarball omitted its browser export')
}
const archive = path.join(artifactsDir, packed.filename)
const consumerDir = await mkdtemp(path.join(os.tmpdir(), 'qvac-browser-consumer-'))
try {
  const installedDir = path.join(consumerDir, 'node_modules/@qvac/sdk')
  await mkdir(installedDir, { recursive: true })
  // Extract without installation: native SDK dependencies are irrelevant to this entry.
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', installedDir])
  const consumer = path.join(consumerDir, 'consumer.mjs')
  await writeFile(
    consumer,
    "export { createBrowserClient, InferenceCancelledError } from '@qvac/sdk/browser'\n"
  )
  const packagedResult = await build({
    absWorkingDir: consumerDir,
    entryPoints: [consumer],
    outfile: path.join(distDir, 'sdk-browser.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    metafile: true
  })
  const packagedInputs = Object.keys(packagedResult.metafile.inputs)
  if (
    !packagedInputs.some((input) =>
      input.endsWith('node_modules/@qvac/sdk/dist/src/browser/index.js')
    )
  ) {
    throw new Error('Consumer did not resolve the packed SDK browser export')
  }
  if (Object.values(packagedResult.metafile.outputs).some((output) => output.imports.length)) {
    throw new Error('Packed SDK browser consumer contains external dependencies')
  }
  const sha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex')
  await writeFile(
    path.join(distDir, 'packed-sdk.json'),
    `${JSON.stringify(
      {
        scope: 'Browser JavaScript PoC subset; not a full SDK release or declaration build',
        filename: packed.filename,
        sha256,
        browserExport: '@qvac/sdk/browser',
        files: packed.files.map((file) => file.path),
        consumerInputs: packagedInputs
      },
      null,
      2
    )}\n`
  )
  console.log(`Packed SDK browser export verified through an isolated consumer: ${packed.filename}`)
} finally {
  await rm(consumerDir, { recursive: true, force: true })
}

if (process.argv.includes('--test-sdk')) {
  await build({
    ...options,
    entryPoints: [path.join(sdkDir, 'test/browser-client.test.ts')],
    outfile: path.join(distDir, 'sdk-browser.test.mjs'),
    platform: 'node'
  })
  console.log('Focused SDK test bundle: dist/sdk-browser.test.mjs')
}
