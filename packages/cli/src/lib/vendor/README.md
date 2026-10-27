# Vendored runtime libraries

These licensed artifacts let this CLI run without unpublished registry packages.
The separate source forks retain upstream history. Runtime imports use relative
paths; no checkout or build tool is required by installed users.

| Artifact               | Source                                             | Runtime scope                                                   |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `miniyaml.mjs`         | miniyaml 0.1.0, based on js-yaml 5.5.0             | Public YAML Core parser and data writer                         |
| `miniyaml-openapi.mjs` | Same retained parser sources plus `scripts/vendor` | Private OpenAPI parser with the former js-yaml 4 default schema |
| `qrcode.mjs`           | Tether matrix fork 3.0.0 of qrcode-generator 2.0.4 | Numeric, Alphanumeric and Latin-1 Byte QR matrices              |

The OpenAPI compatibility variant resolves native YAML merge tags before mapping
construction, so aliases, merge precedence, explicit overrides and quoted `<<`
keys keep their meaning. It retains timestamp, binary, ordered-map, pairs and set
tags, v4 mapping-key coercion, signed radix integers and v4 float/timestamp
resolution. The public miniyaml Core artifact is unchanged. CLI output uses its
data writer and makes only unambiguous field/path keys plain for readability.
The compatibility tests record values compared with the previously installed
js-yaml 4.3.2. Parser limits and malformed-document errors come from miniyaml;
error wording is not an API compatibility promise.

Rebuild from source checkouts with their development dependencies installed:

```sh
node scripts/vendor-libraries.mjs --yaml-source /path/to/miniyaml --qr-source /path/to/qrcode-generator
```

The script rebuilds miniyaml, generates the private parser from the checked-in
compatibility entry, copies the QR source and type declarations, and records
source/artifact SHA-256 hashes and upstream revisions in `provenance.json`.
The paths above are command arguments only; generated metadata contains no local
absolute paths. Review the source hashes and tests when updating versions.
`npm run build` copies this directory to `dist/lib/vendor`; standalone bundling
follows the same relative imports.

`LICENSE.js-yaml` is the upstream MIT license, `LICENSE.miniyaml` describes the
Tether Apache-2.0 additions, and `NOTICE.miniyaml.md` retains source attribution.
`LICENSE.qrcode` is Kazuhiko Arase's MIT license; `NOTICE.qrcode.md` records the
exact source tag and modifications. Licenses and notices ship with the artifacts.
