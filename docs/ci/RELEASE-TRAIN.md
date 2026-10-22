# Release trains

A release train releases a set of packages that depend on each other, from one
`release-train-<train>-<x.y.z>` branch, behind one npm approval. Every package
in the train moves in every train release, so each release carries the latest
of the whole chain. nx publishes them in dependency order and skips the
dependents of a package that fails.

Today there is one train, `sdk`:

```
@qvac/inference → @qvac/sdk → @qvac/cli → @qvac/ai-sdk-provider → the two plugins
                     └─ tetherto-qvac-sdk on PyPI, at @qvac/sdk's version
```

A single package can still be released on its own (a hotfix) through its
per-package workflow. The next train moves it above that version.

## Configuration

- **`nx.json` `release.groups`** holds the packages. `engine` (`@qvac/inference`,
  `@qvac/sdk`) is `fixed`: one version for both. `agentstack` (cli, provider,
  plugins) is `independent`. Version settings that differ from the nx default:
  - `versionPlans: true`: bumps come from `.nx/version-plans/`, not commits.
  - `updateDependents: "auto"`: the default (`always`) also bumps dependents
    outside the release groups.
  - `preserveMatchingDependencyRanges: false`: dependents' ranges always move
    to the new version.
  - `adjustSemverBumpsForZeroMajorVersion: false`: a `minor` on `0.x` stays a
    minor.
- **`.github/release-trains.json`** joins groups into a train:
  - `groups`, and `anchorGroup`: a fixed group whose version names the branch
  - `githubRelease`: the one package that gets a GitHub release; the others get
    a `<slug>-v<version>` tag
  - `checks`: the check jobs in `release-train.yml` that must pass. `sdk` uses
    `shared-runtime-libs`, `sdk-python` and `package-checks`.
  - `packageChecks`: the per-package check config `package-checks` runs
    (`.github/sdk-pod-checks.json`, the same one release PRs use)

## Making a release

1. Bring every range between train packages up to the current workspace
   version (for example the plugins' `@qvac/cli` and `@qvac/ai-sdk-provider`).
   nx only rewrites a range it can see as a workspace link.
2. Regenerate each package's NOTICE. The generator runs `npm install` in the
   package directory, which fails once the version pass has moved a train
   dependency to a version npm does not have yet. It also replaces the
   package's `node_modules`; run `pnpm install --frozen-lockfile` afterwards.
3. Write `.nx/version-plans/<ticket>.md` with a bump for every train package.
   Keys are group or project names; values are relative bumps (`major`,
   `minor`, `patch`, `pre*`). nx requires a message after the frontmatter.

   ```markdown
   ---
   engine: minor
   "@qvac/cli": minor
   "@qvac/ai-sdk-provider": minor
   "@qvac/opencode-plugin": patch
   "@qvac/openclaw-plugin": patch
   ---

   Release the sdk train.
   ```

4. Apply it, after reading the dry run, then delete the plan. nx leaves it in
   place and applies every plan on disk on its next run. Do not pass
   `--groups`, `--projects` or a version specifier.

   ```bash
   pnpm exec nx release version --dry-run
   pnpm exec nx release version
   rm .nx/version-plans/<ticket>.md
   ```

5. Write a changelog section for each package (`qv-sdk-changelog`), and bring
   `packages/sdk-python` and `packages/sdk-kotlin` to the new `@qvac/sdk`
   version (Steps 3 and 3b of `qv-sdk-inference-version`).
   `pr-checks-sdk-kotlin.yml` checks the Kotlin version on both PRs.
6. Cut `release-train-sdk-<engine version>` from `upstream/main`. Open the
   release PR into it from a head not named `release-*`, and the backmerge PR
   into `main` from `backmerge/release-train-sdk-<engine version>`.

   The documentation site has one step here. **Run `qv-docs-cutoff` right
   after cutting the train branch**, passing the version being released; it
   opens one PR into `main` and reports its URL. The documentation engineer
   reviews and merges it. That review is how the documentation side of the
   release is verified — no CI check does it — so do not approve or merge it
   yourself. The checks they run are in
   [`docs/website/docs-workflow.md`](../website/docs-workflow.md), "Reviewing
   the cutoff PR". It lands on `main`; the train branch is the release's
   target, never documentation's. Nothing in steps 1 to 8 waits on it, and it
   touches no package.

   What the PR does, per collection the train moves: regenerate the API
   summary of the version being released, publish that version's line — the
   line the sprint was written into, which until now sat outside the site at
   `content/_unpublished/<collection>/next/` — and preserve the previously
   published line at its versioned URLs. The development line stays where it
   is and is now the next version's, which is where the coming sprint's
   feature PRs write. No folder is renamed across versions and none is
   deleted.

   Why here and not at step 7 or 8: the line has to be published from the tree
   the release was cut from, and the development line has to be free for the
   next sprint from the moment its development starts.

   Skipping this step is the one option that is not available: the version
   would ship with the previous version's documentation. If the documentation
   engineer is unavailable to review, the PR waits — it blocks no other step.
7. Wait for the release PR's `Release Train (nx)` run, the dry run described
   under [Checks](#checks), then merge the release PR. `release-train.yml`
   then:
   1. checks the branch and lists the packages whose version moved
   2. builds and packs the train, and runs the train's checks
   3. publishes the train to npm after the `npm` approval, as `latest`
   4. waits until npm serves it, and runs each package's checks again against
      npm
   5. publishes `tetherto-qvac-sdk` after the `pypi` approval
   6. tags each package, creates the SDK's GitHub release and attaches the fat
      wheels
8. Merge the backmerge PR once the push run has published to npm. Before that,
   `main` would name versions that the checks of later PRs cannot install. If
   the run fails before publishing, fix it with a PR into the train branch
   (see [Recovery](#recovery)) and carry the same commit to the backmerge.
9. Promote the documentation to production, once the versions are on npm. Run
   `promote-docs-production.yml` on the merge commit of step 6's PR, after the
   preflight prints the content diff. Promoting before npm would publish
   documentation for a version nobody can install; promoting a later commit
   would publish whatever else merged into `main` meanwhile. The procedure is
   in [`docs/website/docs-workflow.md`](../website/docs-workflow.md),
   "Promoting to production".

## Checks

On the release PR (`pr-release-guard.yml` and `release-train.yml`) and on every
push (`release-train.yml`):

- every train package moves, and each anchor package is at the branch version
- every range between train packages accepts the new version of its target
- each moved package has notes under `## [<version>]` in its `CHANGELOG.md`
- no `.nx/version-plans/` file is committed
- on the PR: npm does not have any moved version yet
- on push: a version npm already has was published from this commit (its
  `gitHead`); otherwise the branch has released and the run stops

Before npm publish:

- **`package-checks`**: each package's checks from `.github/sdk-pod-checks.json`
  (install, format, lint, typecheck, build, unit, bare and e2e tests, and the
  SDK's consumer installs), with every train package installed from a tarball
  of this commit and everything else from npm. The backmerge PR, from
  `backmerge/release-train-<train>-<x.y.z>` into `main`, runs the same through
  `pr-checks-sdk-pod.yml`.
- **`shared-runtime-libs`**: `check-shared-runtime-libs.mjs` for inference and
  sdk, as `publish-inference.yml` and `publish-sdk.yml` run it.
- **`sdk-python`**: the Python contract check, build, version lockstep and
  `twine check`.
- a workspace package outside the train that the train links must be on npm at
  the linked version.

After npm publish, `package-checks` runs again with every package installed
from npm. Tags, the GitHub release, PyPI and the wheels wait for it.

### Dry run

Every PR into a train branch runs `release-train.yml` as a dry run: the checks
above, the build, and `pnpm publish --dry-run`, which also stops on a version
below npm's `latest`. The run measures the train from the merge base with
`main`, so a fix PR after the release PR checks the whole train again. A
`workflow_dispatch` with `dry_run: true` on the train branch does the
same. A dry run publishes, tags and releases nothing, and needs no approval:
`pnpm publish --dry-run` runs in its own job, with no environment and no
`id-token`. Publishing runs only on a push or a dispatch without `dry_run`, in
the job that holds the `npm` environment. Both jobs wait for `checks-passed`,
which requires the build and every check the train lists.

## Publishing

- Every version is published as `latest`. A version below npm's `latest` stops
  the run; an older line is released through its per-package workflow.
- `gitHead` in each published manifest is the commit it was built from. Each
  tag goes on that commit.
- npm's sha of each published tarball must match the tarball the build job
  packed.
- A version npm already has is skipped.

## Recovery

- **Nothing published yet** (a check failed, or the approval was rejected): fix
  it with a PR into the same branch.
- **Partly published, transient error**: re-run the workflow on the same
  commit. Versions on npm from that commit are skipped.
- **Partly published, fix needs a new commit**: the branch can no longer
  publish. Cut a new train with new versions for the packages npm already has;
  the others can keep theirs.
- `workflow_dispatch` with `publish_pypi_only: true` publishes PyPI alone.

## Per-package workflows

The per-package publish workflows for the six train packages run their merge
guard on push and on `workflow_dispatch`, with `strict-slug`: a branch other than
`release-<slug>-x.y.z` fails, so a train branch cannot publish through them.

## Before the first train

npm trusted publishing names a workflow file. Add `release-train.yml` as a
trusted publisher for every package in the train on npm, with environment
`npm`, and for `tetherto-qvac-sdk` on PyPI, with environment `pypi`. A release
PR runs its own copy of `release-train.yml`; binding the publisher to the
environment means only a job that passed that environment's approval gets a
token npm or PyPI accepts. Keep the per-package workflows registered too: npm
allows up to 10 trusted publishers per package, and a hotfix still publishes
through them.
