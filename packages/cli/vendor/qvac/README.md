# CLI runtime snapshots

The CLI carries reviewed SDK/inference workspace builds because its commands use
the current APIs and the SDK native TypeScript config-loader bridge. Their
external dependency policy remains unchanged: SDK/inference keep
`fast-safe-stringify`, `semver`, and their published Zod dependency specifications.
The owning source packages retain their original logging implementation.

Core 1.0.0-rc.2 and Harness 1.0.0-rc.10 retain integrity-verified published runtime
bytes. Their maintained manifests use the CLI's reviewed library replacements,
pin the tested Bare dependencies, and omit optional Python/QuickJS peers that the
explicit provider builder prepares separately. Provider patch files remain.

Distribution-only adaptations apply to the snapshots, not their owning source
manifests:

- Maintained siblings use exact versions satisfied by the CLI's bundled packages.
- SDK/Core/Harness declare large native modules as required host peers. The CLI
  supplies those host dependencies, avoiding recursive bundling of every native
  package. Classification 0.32.0 and OCR 0.30.1 come directly from npm.
- The compatible native family includes embed 0.52.1 (required `Reranker` API),
  llm 0.64.3, and the tested Bare 1.34.0 binary.
- CLI SDK commands scope the native TypeScript importer to each invocation, so the
  CLI SDK snapshot omits its standalone optional `tsx` peer.
- Build/test payloads and source maps are omitted; runtime files, exports, types,
  licenses and required assets are retained.

`PROVENANCE.json` records the base commit and authoritative source-file hashes for
workspace builds (including reviewed changes not yet committed), or the exact npm tarball URL and SHA-512 for published packages. Every
retained package file has a SHA-256. The verifier rejects extra runtime files.

Regenerate after installing development dependencies in the owning workspace:

```sh
node scripts/sync-qvac-vendors.mjs /path/to/qvac/packages
```

This builds SDK/inference and extracts Core/Harness only after verifying their
pinned archives. Review generated diffs and provenance. Core/Harness cleanup does
not silently rewrite SDK/inference dependencies.

Native `prebuilds/` at any depth, currently the Harness Windows sandbox binaries,
are ignored by Git. Before a source build or pack, run:

```sh
node scripts/prepare-qvac-vendors.mjs
node scripts/prepare-qvac-vendors.mjs --check
```

Preparation validates tracked files, fetches only missing native artifacts from
the exact pinned tarball, verifies SHA-512 before extraction and SHA-256 for each
file, and materializes those files. Node and the system `tar` command are needed.
`QVAC_VENDOR_CACHE` selects the tarball cache; otherwise the operating system temp
directory is used. A verified cached tarball works offline. `--check` never writes
or fetches. The build/pack path prepares assets and checks the installed package;
installed CLI execution does not mutate snapshots or download these assets.
