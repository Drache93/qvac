# Fabric WebGPU browser PoC

This experimental package runs the pinned fabric engine as WebAssembly inside a
dedicated browser Worker. The demo uses the actual `@qvac/sdk/browser` entry and
the SDK's shared completion implementation. No Bare process, native addon, or
inference server runs behind the browser UI.

## Run the prepared demo

With the generated `dist/` assets present:

```sh
node demo/server.mjs
```

Open **http://127.0.0.1:8787/demo/**. Click **Load model**, then **Generate**.
The default model is Qwen3.5-2B Q4_K_M, downloaded directly by the Worker. It is
1,396,198,496 bytes. The model is not included in the package. Stop, Unload and
Close exercise the browser runtime lifecycle. **Download evidence** saves the
engine logs, adapter information, streamed events, final results and timings.

The PoC's browser HTTP path implements the native QVAC path's core observable
resume behavior: bounded retries, `Range`/`206` validation and persistent partial files. A
Dedicated Worker checkpoints received bytes in OPFS, so a network drop or page
reload resumes from the last durable offset. Completed files remain cached after
Unload and Close; the engine reads the completed File directly through a
read-only WORKERFS mount, avoiding a full model copy into MEMFS. Browsers without synchronous OPFS handles retain the
weaker close-on-error fallback and cannot guarantee crash-safe checkpoints.
This implementation is provisionally colocated here for the demonstration. The
production boundary is a browser-safe `@qvac/inference` acquisition provider;
Fabric should consume its completed File/Blob and own only its filesystem mount.
Without OPFS, downloads use an ephemeral Blob and do not survive reloads. That
fallback can still consume substantial browser memory. WORKERFS copies requested
read slices; it does not eliminate WASM tensor, staging or GPU allocations.

Use a browser exposing a usable WebGPU adapter with `shader-f16`. The loader
uses wasm32/Asyncify by default, avoiding a JSPI or memory64 requirement. It uses
an 8 MiB stack and at most 4 GiB of WASM linear memory. Model input, GPU buffers
and browser overhead consume additional memory. A successful adapter probe alone
does not establish that the model fits or that inference is correct.

The pinned engine's subgroup shaders also use WGSL `subgroup_id`/
`num_subgroups`, supported in Chromium 144 and newer. The Worker checks this
before downloading the model. See [Chrome's WGSL feature announcement](https://developer.chrome.com/blog/new-in-webgpu-144).

The pinned source has a versioned, checksum-verified local patch that retries a
low-power adapter if the preferred adapter lacks required features. Registration
and device creation reuse the selected adapter. No upstream merge or release is
needed to build this PoC. The JavaScript preflight follows the same selection.

On the tested Intel xe-lpg path, multi-token prefill generated incorrect text
across Chrome 150/156, wasm32/wasm64 and JSPI/Asyncify. One-token prefill passed
correctness tests, so the Worker uses that workaround on Intel and retains batch
128 on other adapters. The faulty kernel has not been identified. The workaround
is not a general Intel driver certification.

The local Linux/X11 acceptance run uses the installed Chrome with only Vulkan
enabled, without unsafe-WebGPU, Dawn-f16 or compositor overrides:

```sh
google-chrome --user-data-dir=/tmp/qvac-webgpu-poc --enable-features=Vulkan http://127.0.0.1:8787/demo/
```

This is experimental: enabling Vulkan overrides Chromium's normal Vulkan
compatibility gating. It is not a default-settings production acceptance run.
The page cannot enable browser features or change drivers. Missing capabilities
produce an error rather than silent CPU inference. Default X11 Chrome returned
no adapter; isolated Wayland probes also failed and do not establish behavior in
a normal Wayland desktop session. A tab reporting `webgpu: true` can still lack
an adapter.

The existing SDK's native runtime remains the installed-app route on Linux,
macOS, Android and iOS. This package adds a browser host for the same completion
contract; it does not replace native addons with WASM on those platforms.
Safari/iOS and Android browser acceptance requires real-device feature, memory,
output and lifecycle validation. Linux results do not certify those platforms.

## Rebuild

Rebuild from the monorepo checkout; the tarball contains the prepared demo.
Build on a development machine with adequate memory. Install and activate
Emscripten **4.0.23**, plus CMake, Ninja, Python 3, unzip and Node.js. The source
and Dawn archives are pinned and SHA256-checked by `source-lock.json`.

```sh
npm run build
node scripts/bundle-demo.mjs --test-sdk
node --test dist/sdk-browser.test.mjs test/*.test.js
```

The bundle script requires esbuild available through SDK development dependencies,
or `QVAC_ESBUILD_MODULE` set to an installed esbuild module's absolute path.
It builds the real SDK browser entry, packs it, extracts it into an isolated
consumer and resolves `@qvac/sdk/browser` through its package export. It does not
install the native SDK dependency tree. `dist/packed-sdk.json` and
`dist/bundle-inputs.json` record delivery and dependency evidence.

That packed SDK is a **browser-only PoC build**, not a complete SDK release;
native entries and TypeScript declarations need the normal SDK build. Nothing
here publishes a package. The demo is served from the generated self-contained
browser bundle, matching Worker, Emscripten glue and WASM binary.

The package builds one wasm32/Asyncify artifact in `dist/wasm-compat`, with
WORKERFS linked explicitly. Its manifest records the source patch, bridge hash,
compiler, filesystem, memory mode and WASM checksum. Rebuild older artifacts
before using the WORKERFS loader.

The Worker statically imports the matching Emscripten glue and uses a literal
WASM asset URL. Packed-package Vite and Webpack production builds were checked
for emitted Worker/WASM files and successful module loading. Browser hosts must
serve those generated assets; copying only the main JavaScript bundle is not
sufficient. The optional runtime `wasmUrl` overrides only the matching WASM
binary, not the Worker or glue, and must refer to the same build.

Optionally download and checksum the model once for repeated local testing:

```sh
node scripts/download-model.mjs
```

Then open:

```text
http://127.0.0.1:8787/demo/?model=http://127.0.0.1:8787/artifacts/models/Qwen3.5-2B-Q4_K_M.gguf
```

Model SHA256:
`57a1085840f497d764a7fc5d346922dbde961efb54cc792ea81d694fd846a1d8`.

## Package a lean browser SDK

The experimental `@qvac/sdk-browser` distribution gives application code one SDK
import. Its fresh manifest has no runtime dependencies; it bundles the real SDK
completion client and browser transport and includes only the compat Worker,
glue, WASM, license information and standalone text-only declarations. Models
are downloaded separately. It does not install native addons or publish a package.

From the monorepo root, install the package's development tools using the checked-in
workspace lockfile. After activating the pinned Emscripten toolchain:

```sh
pnpm --filter @qvac/fabric-llm-web install --frozen-lockfile
pnpm --filter @qvac/fabric-llm-web run build
pnpm --filter @qvac/fabric-llm-web run package:browser
pnpm --filter @qvac/fabric-llm-web run verify:browser-package
```

The final command packs the distribution, installs its tarball into a fresh
temporary consumer, checks the installed public API and cancellation with a fake
runtime, exercises the actual runtime client's Worker transport, and typechecks
a consumer without native dependencies. It records exact installed packages and
bytes in `artifacts/browser-sdk/report.json`, and fails if additional packages or
native library files appear. These checks do not replace real GPU acceptance.

Install `artifacts/browser-sdk/qvac-sdk-browser-0.0.0-poc.tgz` into a browser app.
Copy its installed `src/` and `dist/wasm-compat/` trees together under an application
static directory, for example `/qvac/`, then use only the SDK:

```js
import { createBrowserClient } from "@qvac/sdk-browser";

const client = createBrowserClient({ assetsBaseUrl: "/qvac/" });
const modelId = await client.loadModel({ modelSrc: modelUrl, ctxSize: 2048 });
```

`assetsBaseUrl` points to the directory containing both trees and ends in `/`.
This explicit asset-copy route works independently of Vite/Webpack Worker transforms.
The default relative Worker URL is also available, but a bundled application must
verify that its production build emits the Worker, Emscripten glue and WASM at the
corresponding URLs. The generated declarations describe this limited browser API,
not the entire native SDK.

## Browser acceptance

Install Playwright separately on the validation machine, start the demo server,
download the model, and set `QVAC_PLAYWRIGHT_MODULE` to Playwright's `index.mjs`:

```sh
node scripts/browser-smoke.mjs
```

The runner saves screenshots and JSON under `artifacts/browser-smoke/`. It checks
real SDK generation, cancellation, unload/reload, and interleaved direct-runtime
versus SDK calls using the same WASM artifact and greedy token settings. Set
`QVAC_CHROME_FLAGS` to a JSON string array to control browser launch flags.
The selected browser binary and actual adapter are recorded. Native-versus-web
performance is a separate comparison.

The UI and direct/SDK benchmark Workers use the same wasm32/Asyncify build.
Saved route results are under
`artifacts/routes/`; full-model output and engine offload logs are required,
not just adapter enumeration or a compute shader result.

## Scope

One resident model, one active generation, text histories and temperature/seed/
output-limit settings. The browser SDK rejects unsupported options. Output is
raw text. The demo disables thinking through the model's chat template, while
preserving any raw markers the model emits. Separated reasoning, tools, media,
P2P downloads, persistent KV caches and full native feature parity are not
implemented. HTTP model files and partial downloads are persisted in OPFS.
Cancel is cooperative between bounded GPU operations; Close
terminates the Worker and discards the loaded model while retaining its HTTP
cache. No settings can turn a native `.bare` addon into a browser artifact.

## Test on macOS

PR #5376 is stacked on PR #5375, so its head contains the complete SDK and
runtime PoC. From an existing monorepo checkout:

```sh
git fetch upstream feature-QVAC-26838-browser-poc
git switch --track upstream/feature-QVAC-26838-browser-poc
```

If the local branch already exists, switch to it and run `git pull --ff-only`.
Install CMake, Ninja, Python and Node.js, then activate the exact Emscripten
toolchain used by the source lock:

```sh
brew install cmake ninja python node
corepack enable
corepack prepare pnpm@11.28.2 --activate
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install 4.0.23
./emsdk activate 4.0.23
source ./emsdk_env.sh
```

Return to the monorepo root and build, verify and serve the browser package:

```sh
pnpm install --frozen-lockfile
pnpm --filter @qvac/fabric-llm-web run build
pnpm --filter @qvac/fabric-llm-web run package:browser
pnpm --filter @qvac/fabric-llm-web run verify:browser-package
pnpm --filter @qvac/fabric-llm-web run demo
```

Open `http://127.0.0.1:8787/demo/` in Chrome 144 or newer without command-line
flags. Chrome has shipped WebGPU on macOS since version 113 and maps it to
Metal. Keep Chrome's **Use graphics acceleration when available** setting on.
A successful run reports `backend: WebGPU`, `backendDevice: gpu`,
`modelFilesystem: workerfs`, Flash Attention in the engine configuration and
nonzero prompt/decode throughput. Save the evidence from the demo for review.

For a local model route that does not depend on a long Hugging Face response:

```sh
pnpm --filter @qvac/fabric-llm-web run download:model
pnpm --filter @qvac/fabric-llm-web run demo
```

Open
`http://127.0.0.1:8787/demo/?model=http://127.0.0.1:8787/artifacts/models/Qwen3.5-2B-Q4_K_M.gguf`.
The downloader verifies the model checksum. On a 16 GB machine, set
`QVAC_BUILD_JOBS=2` on the build command if compilation causes memory pressure.

## Fabric revision and prior WebGPU work

The source lock pins Fabric commit `0c93153f`, a merge commit on the current
`temp-11259` line. It includes merged Fabric PR #400, which superseded the
closed exploratory PRs #247-#250 and #259 by adding opt-in dynamic discovery,
high-performance adapter preference, repeated-registry safety, missing-feature
diagnostics, the browser benchmark and corresponding tests/documentation.
The older instruction to retarget those exploratory PRs to `temp-10549` is no
longer applicable; `temp-10549` and the pinned revision have since diverged.

The remaining local patch is narrower: if the high-performance adapter is
present but lacks the required features, it retries the low-power adapter and
reuses the validated adapter for device creation. This should be proposed as a
focused follow-up to Fabric and removed here once a released Fabric revision
contains it.

The SDK runtime is injected explicitly:

```js
import { createBrowserRuntime } from "@qvac/fabric-llm-web";
import { createBrowserClient } from "@qvac/sdk/browser";

const client = createBrowserClient(createBrowserRuntime());
const modelId = await client.loadModel({ modelSrc: modelUrl, ctxSize: 2048 });
const run = client.completion({
  modelId,
  history: [{ role: "user", content: "Hello" }],
  generationParams: { predict: 128, temp: 0, seed: 42 },
});
for await (const event of run.events) {
  if (event.type === "contentDelta") console.log(event.text);
}
console.log(await run.final);
await client.unloadModel({ modelId });
client.close();
```
