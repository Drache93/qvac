# Zod runtime fork

This is the Tether-maintained runtime snapshot of Zod 4.6.5, based on upstream commit `59bbc03e10c636b9eb3c393dfeb552819774ec21`. The original MIT license and author attribution are preserved. Runtime JavaScript and declarations are unchanged; distribution metadata excludes upstream development tools and source-only export conditions.

The `zod` module specifier and version are retained so CLI, SDK, Core and Harness share a compatible runtime. This snapshot is bundled with the CLI and does not require publication of a new npm package. The source fork is intended for `tetherto/zod`; no remote repository or npm release is created by this change.
