// Rebuild licensed runtime artifacts from explicit local source checkouts.
// Usage: node scripts/vendor-libraries.mjs --yaml-source <miniyaml> --qr-source <qr-fork>
import { readFile, writeFile, mkdir, readdir, cp } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
function option(name) {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`Required: ${name} <source-checkout>`)
  return resolve(args[index + 1])
}
const yaml = option('--yaml-source')
const qr = option('--qr-source')
const target = fileURLToPath(new URL('../src/lib/vendor/', import.meta.url))
const yamlPkg = JSON.parse(await readFile(join(yaml, 'package.json'), 'utf8'))
const qrPkg = JSON.parse(await readFile(join(qr, 'package.json'), 'utf8'))
if (yamlPkg.name !== 'miniyaml' || qrPkg.name !== 'qrcode-generator') {
  throw new Error('Unexpected source package')
}
execFileSync('npm', ['run', 'build'], { cwd: yaml, stdio: 'inherit' })
await mkdir(target, { recursive: true })
const require = createRequire(join(yaml, 'package.json'))
const { build } = await import(pathToFileURL(require.resolve('vite')).href)
await build({
  configFile: false,
  resolve: { alias: { '@miniyaml': join(yaml, 'src') } },
  build: {
    outDir: target,
    emptyOutDir: false,
    target: 'es2022',
    minify: true,
    lib: {
      entry: fileURLToPath(new URL('./vendor/openapi-yaml.mjs', import.meta.url)),
      formats: ['es'],
      fileName: () => 'miniyaml-openapi.mjs'
    },
    rollupOptions: {
      external: [],
      output: {
        banner:
          '/*! miniyaml private OpenAPI compatibility parser; Apache-2.0 AND MIT; see provenance.json */',
        minify: { codegen: true }
      }
    }
  }
})
await cp(join(yaml, 'lib/index.mjs'), join(target, 'miniyaml.mjs'))
await cp(join(yaml, 'lib/index.d.ts'), join(target, 'miniyaml.d.mts'))
await cp(join(qr, 'index.js'), join(target, 'qrcode.mjs'))
await cp(join(qr, 'index.d.ts'), join(target, 'qrcode.d.mts'))
await writeFile(
  join(target, 'miniyaml-openapi.d.mts'),
  'export declare function parse(source: string): unknown\n'
)
for (const [source, name] of [
  [join(yaml, 'LICENSE'), 'LICENSE.js-yaml'],
  [join(yaml, 'LICENSE.md'), 'LICENSE.miniyaml'],
  [join(yaml, 'NOTICE.md'), 'NOTICE.miniyaml.md'],
  [join(qr, 'LICENSE'), 'LICENSE.qrcode'],
  [join(qr, 'NOTICE.md'), 'NOTICE.qrcode.md']
]) {
  await cp(source, join(target, name))
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function sourceHash(root, entries) {
  const records = []
  async function visit(relative) {
    const full = join(root, relative)
    try {
      const children = await readdir(full)
      for (const child of children.sort()) await visit(join(relative, child))
    } catch (error) {
      if (error.code !== 'ENOTDIR') throw error
      records.push(`${relative.replaceAll('\\', '/')}\0${hash(await readFile(full))}`)
    }
  }
  for (const entry of entries) await visit(entry)
  return hash(records.join('\n'))
}
const artifacts = {}
for (const name of ['miniyaml.mjs', 'miniyaml-openapi.mjs', 'qrcode.mjs']) {
  artifacts[name] = { sha256: hash(await readFile(join(target, name))) }
}
const provenance = {
  format: 1,
  miniyaml: {
    version: yamlPkg.version,
    upstream: { name: 'js-yaml', version: '5.5.0', url: 'https://github.com/nodeca/js-yaml' },
    sourceSha256: await sourceHash(yaml, ['src', 'support/build-library.mjs', 'package.json']),
    changes:
      'Tether Core-only parser and direct writer; private OpenAPI variant adds v4 default tags and scalar/key compatibility using scripts/vendor sources.'
  },
  qrcode: {
    version: qrPkg.version,
    upstream: {
      name: 'qrcode-generator',
      version: '2.0.4',
      commit: '83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8',
      url: 'https://github.com/kazuhikoarase/qrcode-generator'
    },
    sourceSha256: await sourceHash(qr, ['index.js', 'index.d.ts', 'package.json']),
    changes:
      'Tether matrix-only fork; browser/image/encoding-map helpers removed; original matrix algorithms retained.'
  },
  compatibilitySourceSha256: await sourceHash(
    fileURLToPath(new URL('./vendor/', import.meta.url)),
    ['openapi-yaml.mjs', 'timestamp.mjs']
  ),
  artifacts
}
await writeFile(join(target, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n')
