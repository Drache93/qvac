import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(packageDir, "../..");
const sdkDir = path.join(root, "packages/sdk");
const require = createRequire(path.join(packageDir, "package.json"));
const sdkRequire = createRequire(path.join(sdkDir, "package.json"));
function resolveTool(name) {
  try {
    return require.resolve(name);
  } catch {
    return sdkRequire.resolve(name);
  }
}
const esbuildPath =
  process.env.QVAC_ESBUILD_MODULE ??
  process.env.ESBUILD_MODULE ??
  resolveTool("esbuild");
const { build } = await import(pathToFileURL(esbuildPath).href);
const output = path.join(packageDir, "artifacts/browser-sdk");
await mkdir(output, { recursive: true });
const stage = await mkdtemp(path.join(output, "stage-"));
await mkdir(path.join(stage, "dist"), { recursive: true });
for (const name of [
  "client.js",
  "worker.js",
  "worker-host.js",
  "select-adapter.js",
  "model-download.js",
]) {
  await mkdir(path.join(stage, "src"), { recursive: true });
  await cp(path.join(packageDir, "src", name), path.join(stage, "src", name));
}
for (const name of [
  "fabric-llm.mjs",
  "fabric-llm.wasm",
  "build-manifest.json",
  "licenses",
]) {
  await cp(
    path.join(packageDir, "dist/wasm-compat", name),
    path.join(stage, "dist/wasm-compat", name),
    { recursive: true },
  );
}
await cp(path.join(sdkDir, "LICENSE"), path.join(stage, "LICENSE"));
await cp(path.join(sdkDir, "NOTICE"), path.join(stage, "NOTICE"));
await cp(
  path.join(packageDir, "source-lock.json"),
  path.join(stage, "source-lock.json"),
);
await cp(
  new URL("./browser-package.d.ts", import.meta.url),
  path.join(stage, "dist/index.d.ts"),
);

const sourceEntries = {
  "@qvac/inference/surface": "inference/src/surface.ts",
  "@qvac/error": "error/src/index.ts",
  "@qvac/logging": "logging/src/index.ts",
  "@qvac/logging/constants": "logging/src/constants.ts",
  "@qvac/rag/errors": "rag/src/errors.ts",
};
const result = await build({
  stdin: {
    contents: `
      import { createBrowserClient as wrap, InferenceCancelledError } from ${JSON.stringify(path.join(sdkDir, "src/browser/index.ts"))}
      import { createBrowserRuntime } from ${JSON.stringify(path.join(packageDir, "src/client.js"))}
      export { InferenceCancelledError }
      export function createBrowserClient(options = {}) {
        if (options.runtime) return wrap(options.runtime)
        const worker = options.worker ?? (options.assetsBaseUrl
          ? new Worker(new URL('src/worker.js', new URL(options.assetsBaseUrl, import.meta.url)), { type: 'module' })
          : new Worker(new URL('../src/worker.js', import.meta.url), { type: 'module' }))
        return wrap(createBrowserRuntime({ ...options, worker }))
      }
    `,
    resolveDir: root,
    sourcefile: "browser-sdk-entry.mjs",
  },
  outfile: path.join(stage, "dist/index.js"),
  platform: "browser",
  format: "esm",
  bundle: true,
  minify: true,
  target: "es2022",
  metafile: true,
  nodePaths: [
    path.join(packageDir, "node_modules"),
    path.join(sdkDir, "node_modules"),
  ],
  plugins: [
    {
      name: "portable-workspace-source",
      setup(builder) {
        builder.onResolve({ filter: /^@qvac\// }, ({ path: specifier }) => {
          const entry = sourceEntries[specifier];
          if (entry) return { path: path.join(root, "packages", entry) };
        });
        builder.onResolve({ filter: /^#env$/ }, ({ importer }) => {
          if (importer.startsWith(path.join(root, "packages/logging/")))
            return { path: path.join(root, "packages/logging/src/env.ts") };
        });
        builder.onResolve(
          { filter: /^@\// },
          ({ path: specifier, importer }) => {
            const owner = importer.startsWith(
              path.join(root, "packages/inference/"),
            )
              ? "inference"
              : "sdk";
            const base = path.join(
              root,
              "packages",
              owner,
              "src",
              specifier.slice(2),
            );
            return {
              path: existsSync(`${base}.ts`)
                ? `${base}.ts`
                : path.join(base, "index.ts"),
            };
          },
        );
      },
    },
  ],
});
const inputs = Object.keys(result.metafile.inputs);
assert.ok(
  !inputs.some((input) =>
    /node-rpc-client|bare-runtime|llm-llamacpp|\/worker\/index/.test(input),
  ),
  "Browser bundle contains native SDK code",
);
assert.ok(
  Object.values(result.metafile.outputs).every(
    (file) => file.imports.length === 0,
  ),
  "Browser bundle has external runtime imports",
);
await writeFile(
  path.join(output, "bundle-inputs.json"),
  JSON.stringify(result.metafile, null, 2),
);
const manifest = {
  name: "@qvac/sdk-browser",
  version: "0.0.0-poc",
  type: "module",
  license: "Apache-2.0",
  description: "Experimental text-only browser SDK distribution",
  exports: {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./worker": "./src/worker.js",
    "./wasm": "./dist/wasm-compat/fabric-llm.wasm",
    "./package.json": "./package.json",
  },
  files: [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/wasm-compat",
    "src",
    "source-lock.json",
    "LICENSE",
    "NOTICE",
    "README.md",
  ],
  dependencies: {},
};
await writeFile(
  path.join(stage, "package.json"),
  JSON.stringify(manifest, null, 2),
);
await writeFile(
  path.join(stage, "README.md"),
  `# Browser SDK PoC\n\nImport createBrowserClient from @qvac/sdk-browser. The package contains one wasm32/Asyncify WebGPU profile and no native dependencies. This is an experimental text-only distribution, not a published SDK release.\n\nWorker and WASM assets must remain available together. Copy this package's src/ and dist/wasm-compat/ trees under a static URL and set assetsBaseUrl to that directory, or verify your bundler preserves the default relative Worker URL. A browser build alone does not establish GPU compatibility.\n\nThe standalone declarations describe the supported text-only subset. Tools, media, reasoning separation and native SDK configuration are unsupported. Models are fetched separately and are not included.\n`,
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = JSON.parse(
  execFileSync(
    npm,
    ["pack", "--ignore-scripts", "--json", "--pack-destination", output],
    { cwd: stage, encoding: "utf8" },
  ),
)[0];
const archive = path.join(output, packed.filename);
const report = {
  package: manifest.name,
  version: manifest.version,
  archive,
  stage,
  tarballBytes: packed.size,
  unpackedBytes: packed.unpackedSize,
  tarballSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  wasmSha256: createHash("sha256")
    .update(
      await readFile(path.join(stage, "dist/wasm-compat/fabric-llm.wasm")),
    )
    .digest("hex"),
  verified: false,
};
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(report, null, 2),
);
if (process.argv.includes("--verify")) {
  const consumer = await mkdtemp(
    path.join(os.tmpdir(), "qvac-browser-sdk-consumer-"),
  );
  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({
      name: "browser-sdk-consumer",
      private: true,
      type: "module",
    }),
  );
  const installOutput = execFileSync(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    { cwd: consumer, encoding: "utf8" },
  );
  await writeFile(path.join(output, "install.log"), installOutput);
  await cp(
    new URL("./verify-browser-package.mjs", import.meta.url),
    path.join(consumer, "verify.mjs"),
  );
  const apiOutput = execFileSync(process.execPath, ["verify.mjs"], {
    cwd: consumer,
    encoding: "utf8",
  });
  await writeFile(path.join(output, "api.log"), apiOutput);
  await writeFile(
    path.join(consumer, "verify-types.ts"),
    `
    import {createBrowserClient, InferenceCancelledError, type CompletionRun} from '@qvac/sdk-browser'
    const client = createBrowserClient({assetsBaseUrl:'/qvac/', onProgress(progress) { console.log(progress.downloaded) }})
    const run: CompletionRun = client.completion({modelId:'m',history:[{role:'user',content:'Hi'}],generationParams:{predict:64,temp:0}})
    run.final.then(value => console.log(value.contentText, value.raw.fullText))
    const error: Error = new InferenceCancelledError('cancelled')
    console.log(error)
    // @ts-expect-error Tools are outside the browser PoC contract.
    client.completion({modelId:'m',history:[],tools:[]})
  `,
  );
  execFileSync(
    process.execPath,
    [
      resolveTool("typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2022,DOM",
      "verify-types.ts",
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  const lock = JSON.parse(
    await readFile(path.join(consumer, "package-lock.json"), "utf8"),
  );
  const installed = Object.keys(lock.packages)
    .filter((key) => key.startsWith("node_modules/"))
    .map((key) => key.slice("node_modules/".length));
  assert.deepEqual(
    installed,
    ["@qvac/sdk-browser"],
    "Lean install pulled additional packages",
  );
  let bytes = 0;
  let files = 0;
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await inventory(file);
      else if (entry.isFile()) {
        assert.ok(
          !/\.(bare|node|so|dylib|dll)$/.test(entry.name),
          `Native artifact in lean package: ${file}`,
        );
        bytes += (await stat(file)).size;
        files++;
      }
    }
  }
  await inventory(path.join(consumer, "node_modules"));
  Object.assign(report, {
    verified: true,
    consumer,
    installedPackages: installed,
    installedRegularFileBytes: bytes,
    installedRegularFiles: files,
    apiOutput: apiOutput.trim(),
    declarationsChecked: true,
  });
}
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
