---
name: qv-release-train
description: Release the packages of a release train (inference, sdk, cli, ai-sdk-provider, the two plugins) together from one branch and one publish run. Use when releasing the SDK chain, writing a version plan, or invoking /qv-release-train.
---

# Release train

Follow `docs/ci/RELEASE-TRAIN.md`. It holds the procedure, the configuration
and the checks CI runs. This skill adds what an agent does differently.

## When to use

- The user asks to release the SDK chain or the train, or invokes
  `/qv-release-train`.

A hotfix of one train package, and any package outside every train
(`registry-server`, `rag`, `logging`, `error`, `test-suite`), stays on the
per-package flow in `docs/gitflow.md`.

## Agent rules

- Run `/qv-agent-stack-sync --plan` first and show the user its table. Every
  train package moves; ask the user for the bump of each when the plan and the
  work do not make it clear.
- Before the version pass, set every range between train packages to the
  current workspace version, then run `pnpm install --lockfile-only`.
- Generate the NOTICE files (`qv-sdk-changelog` Step 6) before the version
  pass; `docs/ci/RELEASE-TRAIN.md` step 2 says why.
- Show the user the `nx release version --dry-run` output before applying it.
- Do not run Step 2 of `/qv-sdk-inference-version`: the version pass writes the
  `@qvac/inference` range. Its Steps 3 and 3b still apply.
- Open both PRs with `qv-sdk-pr-create`: one release PR, one backmerge, for the
  whole train.
- Invoke `qv-docs-cutoff` right after cutting the train branch, passing the
  version being released. It opens one documentation PR into `main` and
  reports its URL. Nothing in steps 7 and 8 waits on it.
- Do not approve or merge the documentation PR. The documentation engineer
  reviews it — that review is the only gate on the documentation side of the
  release.
- Tell the user, at step 9, that the merged documentation commit is what goes
  to `promote-docs-production.yml`, and only once the versions are on npm.
  Promoting earlier publishes documentation for packages nobody can install.
- Never approve the `npm` or `pypi` deployment; tell the user when each waits.
- On a failed run, report it. Do not publish a package by hand and do not move
  or delete a tag.
