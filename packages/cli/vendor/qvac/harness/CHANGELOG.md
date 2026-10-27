# Changelog

All notable changes to `@qvac/harness` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the major version is `0`, a breaking change bumps the minor version.

Each entry ends with the issue or pull request that made it. The examples call
a `Harness` named `harness` (or `spawnHarness` for a sidecar), in the shape the
API had in that release; a breaking change shows the call before and after.

## [Unreleased]

1.0 makes the harness a small core that plugins extend. Speech, translation,
image, music, weather, web search, Obsidian, Python and MCP are now plugins a
host composes as instances, and the harness builds `exec` from what they
declare. Runs gain handoffs, plans and goals, steering, deferred tools, a fold
for long chats and parallel decoding. [README.md](README.md) is the tour; every
breaking change is listed under Changed and Removed.

### Added

- The macOS and Linux sandboxes take `writable`: absolute folders every shell line may write on
  top of the run's policy, for a toolchain cache outside the project such as Go's build cache.
  The file tools never see them, they are made at setup if missing, and a denied root still wins.
  `Policy.withWrites(policy, roots)` returns a compiled policy that may also write those roots.
- A call that fails three times in a row, such as a test command the model
  keeps patching against, comes back with a note telling the model to step
  back: re-read the output and the requirements, find what the failures share
  and change approach. The note repeats every third failure and a success
  clears the streak. `wording.toolFailing` replaces the text; `{count}` is the
  streak length.
- `Tools.product` takes `files: false` to leave the file tools out, for a host
  with no folder to share, such as a phone entry that composes its tools with
  the mcp, web-search and weather plugins. `isDeviceSharedCredentialKey` from
  `@qvac/harness/skill-state` names the first-party plugins' device-shared
  credential keys for a client that has no skill readiness to read them from.
- `CompletionContext.modelRound` sends each `generating` and
  `wrapping` model round to another device. It gets the request the local
  round would send and streams `content` and `thinking` back through `emit`;
  tools, the stop hook and `answering` stay on the run owner.
  A run started with it pauses for it on resume. A paused or cancelled round,
  local or remote, now ends at once even when the model sends nothing. See the
  [decision record](docs/decisions/2026-10-19-a-remote-host-serves-the-model-round.md).
  (#493)
- `ModelRoundIo.retake()` restarts a remote round when another host takes it:
  the run emits `round-reset` for the round and the returned emitter carries
  the new taker's chunks, while the earlier taker's late chunks are dropped.
  The port resolves with the new taker's result. (#497)
- `harness.serveModelRound(request, io)` serves a model round on the model
  host: it leases `request.modelId` and runs the same round a local
  run does, with the context ladder and the forced-call fallback, and is
  refused with `HARNESS_SUSPENDED` while suspended. Core sends it the
  `ModelRoundRequest` whole. A remote round now answers an unclosed think from
  the host's replay, and its request carries `unforced`. See the
  [decision record](docs/decisions/2026-10-19-a-remote-host-serves-the-model-round.md).
  (#541)
- A remote round crosses the wire on both sides. A `RemoteHarness` from
  `spawnHarness`, `connectHarness` or `harnessChild` (the mobile worker) takes
  `modelRound` and `roundCut` on the run owner, and serves
  `serveModelRound(request, io)` on the model host, so neither device embeds a
  second `Harness` beside its sidecar or worker. They ride the `completion`
  stream as `model-round-*` and `round-cut` frames, and an abort crosses it as
  the run's does. The `CAPABILITY_UNSUPPORTED` refusal from #542 is gone.
  See the
  [decision record](docs/decisions/2026-10-19-a-remote-host-serves-the-model-round.md).
  (#542, #616)

  ```js
  const owner = spawnHarness(options)
  owner.completion({ ...run, modelRound: (request, io) => host.serveModelRound(request, io) })
  ```

- `ToolSets` names a round's tool set by hash, so a shared chat carries each
  set's schemas once. A remote round's request now carries `toolSet`, the
  `ToolSets.hash` of its `tools`, on every round that has tools. The run
  owner writes the schemas only when its `ToolSets` cannot `resolve` the
  hash, and a model host replays the chat into a `ToolSets` and resolves
  each request's `toolSet` (#495).

  ```js
  const tools = toolSets.resolve(request.toolSet)
  ```

- A turn's context is data the host can replay. A run reports what it added to
  each user turn (its time, the knowledge it retrieved, a `promptSubmit` hook's
  context) once, as a `context` event. A host stores it and sends it back as
  that message's `context`, and the harness renders the turn byte for byte as
  it was sent. With `replaysContext: true` such a run keeps its `cacheKey`. A
  steer's or follow-up's `input` event now carries the words as typed (#494).

  ```js
  { role: 'user', content: 'How cold is it?', context: event.context }
  ```

- The `HarnessLog` class is the log's API, through statics:
  `HarnessLog.warn('unload failed')`, `HarnessLog.setSink(sink)`,
  `HarnessLog.setLevel('warn')`. The root names `hlog`, `harnessLog`,
  `setHarnessLog`, `setHarnessLogLevel` and `setHarnessLogSink` stay and
  call the statics; `hlog` logs at `info`. (#532)
- `LanguageHint` (`@qvac/harness/plugins/language-hint`): a prompt that is not
  in English reaches the model with its language and its English, translated on
  device, so a small model can route and call tools from it. It needs
  `TranslationPlugin`, which now provides the `translation` service (#407).

  ```js
  new Harness({ plugins: [new TranslationPlugin(), new LanguageHint()] })
  ```

- An access policy: one optional `AccessPolicy` for files, network, Unix
  sockets, exec, env and rules, with the presets `read-only`,
  `workspace-write` and `full`. `HarnessOptions.policy` is the ceiling;
  `AgentConfig.policy` (one `json` field on the wire) and
  `CompletionContext.policy` (in-process only) only narrow it. The harness
  compiles the three layers at run start; a grant outside the policy fails the
  run before round 1. `files.write` bounds the write grants and grants
  nothing itself. `Policy`, exported from `@qvac/harness`, narrows and
  compiles one. (#388)
- Policy rules decide per call. A rule is
  `{ decision, tool?, command?, paths?, hosts? }`: `command` is an argv
  prefix matched against each simple command of a parsed shell line, `paths`
  are globs and `hosts` are exact hosts or `*.example.com`. Any deny wins, a
  line a rule cannot read asks, and a compound line is allowed only when
  every part matches an `allow` rule. A tool with no rule for it is
  unchanged. The built-in `PolicyRulesHook` evaluates them, appended after the
  host's and the plugins' hooks of a run with rules; a tool exposes what it
  matches through the new `ToolDefinition.command` and
  `ToolDefinition.paths`. A malformed rule fails the run at start. (#390)

  ```js
  const policy = {
    rules: [
      { decision: 'allow', command: ['git', 'status'] },
      { decision: 'deny', command: ['rm'] },
      { decision: 'ask', tool: 'read_files', paths: ['/Users/u/.ssh/**'] }
    ]
  }
  harness.completion({ model, messages, agent: { ...agent, policy } })
  ```

- `network.mode: 'hosts'` runs. `web_fetch`, `http_request`, a plugin tool's
  fetch (MCP included) and Python reach only the hosts in `network.hosts`, on
  every redirect hop; delegate's external targets need `mode: 'on'`. The new
  `EgressProxy` plugin (`@qvac/harness/plugins/egress-proxy`) gives
  `SeatbeltSandbox` a loopback proxy per call, and the profile allows no other
  remote socket, so `SeatbeltSandbox` holds `hosts` while it is loaded and
  names it in the refusal otherwise. The host shell refuses `hosts`.
  `Policy.allowsHost` is the one matcher (exact or `*.example.com`) for rules
  and `network.hosts`, and host lists narrow by coverage. A plugin may now
  `wants` a service it uses only when present. (#389)

  ```js
  const harness = new Harness({
    exec: true,
    policy: { network: { mode: 'hosts', hosts: ['pypi.org', '*.pythonhosted.org'] } },
    plugins: [new SeatbeltSandbox(), new EgressProxy()]
  })
  ```

- Plugins. `HarnessOptions.plugins` takes `HarnessPlugin` instances that add
  tools, hooks, services, `exec` languages, routes and a shell, and tools only
  `invoke` reaches (`PluginSetup.capabilities`). Setup gets `ctx.services`,
  `ctx.onDispose`, `ctx.deniedRoots` and, for a tool that declares `egress`,
  `ctx.fetch`; it may `need` the core's `models` service (`ModelHost`) and
  return `unload()` and `unloadIdle()`. A plugin tool is a write unless the
  host grants it in `read`.
  `@qvac/harness/plugins` exports `PluginRegistry`. Every plugin but
  `code-mode`, `lsp` and `python` has a `qvac-plugin-<name>` manifest to pack
  on its own (none published yet); the export keys the plugins import are
  internals, not a stable API. See [Plugins](README.md#plugins), the
  [plugin framework](lib/plugins/README.md) and
  [a custom plugin](examples/custom-plugin/README.md). (#171, #187, #284, #296,
  #299)
- Agents that hand off. `CompletionContext.agents` holds the agents a run may
  hand to; `transfer_to_agent` emits a `transfer` event (`TransferEvent`) and
  the run goes on as the next agent's, each hop a run of its own, at most three
  transfers. `AgentConfig.model` runs an agent on its own model, and `input`
  reaches whichever hop is running. See
  [Agents that hand off](README.md#agents-that-hand-off) and
  [examples/handoffs](examples/handoffs/README.md). (#233, #247, #318)
- External agents on the user's own login. `login: 'user'` on an
  `ExternalAgents` target runs a CLI the user signed in to, with no API key;
  `'isolated'` stays the default. See
  [Hand the hard parts to Claude Code](README.md#hand-the-hard-parts-to-claude-code)
  and [plugins/external-agents](plugins/external-agents/README.md). (#319,
  #328)
- MCP servers. `McpPlugin` from `@qvac/harness/plugins/mcp` adds each server's
  tools as `<server>__<tool>`, each asking for approval; a server that fails or
  does not answer in 10 s adds none. `auth: { tokenCredentialKey }` sends a
  credential to that server only, and `generic: true` adds `mcp_call` and the
  skill catalog's mcp operations. See [plugins/mcp](plugins/mcp/README.md).
  (#277)
- Deferred tools. A `ToolDefinition` with `defer: true` (and an optional
  `group`) is listed by name in `tool_search` until the model loads it, so the
  prompt prefix stays cached as the tool list grows; `McpServerConfig.defer`
  defers a whole server. See
  [Large tool sets, on demand](README.md#large-tool-sets-on-demand). (#311)
- Coding on macOS. `CodingPlugin` adds `shell` (keeps cwd and exports between
  calls) and `shell_jobs` (background jobs) in a `coding` toolset; file
  writes come from the files toolset's `write_file`. They run in a `sandbox` service provider (`SandboxService`).
  `SeatbeltSandbox` from `@qvac/harness/plugins/sandbox-macos` provides it, and
  runs `exec`'s shell under `sandbox-exec` with a `read-only` or
  `workspace-write` preset. It is not isolated, so every coding call asks. See
  [Sandboxed code](README.md#sandboxed-code),
  [plugins/coding](plugins/coding/README.md) and
  [plugins/sandbox-macos](plugins/sandbox-macos/README.md). (#179, #254, #279,
  #296, #320, #329)
- Exec confined on Windows. `AppContainerSandbox` runs `exec`'s shell lines in
  an AppContainer through a small C helper, under the run's access policy:
  writes only to the write roots, reads only what is granted, and the network
  on or off. Loopback stays closed, and the helper's grants stay on the
  granted folders. See [plugins/sandbox-windows](plugins/sandbox-windows/README.md).
  (#386)
- Exec confined on Linux. `LinuxSandbox` runs `exec`'s shell lines under
  bubblewrap, with mounts built from the run's access policy: writes only to
  the write roots, reads only what a `files.read` list names, denied roots
  masked, and with the network off a seccomp filter that closes every socket
  connect. It provides the `sandbox` service `CodingPlugin` runs in. See
  [plugins/sandbox-linux](plugins/sandbox-linux/README.md). (#385)
- More places to run code. `QuickJs` runs `exec` with `language: "javascript"`
  in QuickJS WASM, with no files or network. `CodeMode` adds `run_code`, a
  script that calls the run's other tools, for `mid` models and up
  (`ToolDefinition.callsTools`, `minCapabilityProfile`). `VmShell` runs exec's
  shell in a barevisor VM, and `Python` adds Pyodide. See
  [plugins/quickjs](plugins/quickjs/README.md),
  [plugins/code-mode](plugins/code-mode/README.md),
  [plugins/sandbox-vm](plugins/sandbox-vm/README.md) and
  [plugins/python](plugins/python/README.md). (#174, #178, #232, #237)
- Language servers. `LspPlugin` adds a read tool, `lsp` (`definition`,
  `references`, `hover`, `symbols`, `diagnostics`), over the servers a host
  configures. See [plugins/lsp](plugins/lsp/README.md). (#202)
- Knowledge. The `Knowledge` plugin keeps one index the host feeds through
  `knowledgeUpsert`, `knowledgeRemove`, `knowledgeSearch` and
  `knowledgeStatus`; `CompletionContext.knowledge = { scopes }` injects the hits
  into the last user turn, and `tool: true` adds `knowledge_search`. See
  [plugins/knowledge](plugins/knowledge/README.md). (#197)
- MOSS text-to-speech. `new Speech({ tts: 'moss' })` streams, clones a voice
  from a 24 kHz `voice` wav, or speaks a `dialogue` of up to five speakers.
  `Parakeet-TDT-1.1B-Q8_0` is a curated English-only transcription model; the
  0.6B stays the default. A plugin that provides `speech` implements
  `SpeechService.defaultModel(profile)`, which the core calls to pick the voice
  model for a `speak` that names none. See
  [plugins/speech](plugins/speech/README.md). (#312, #315)
- A `base` music choice runs the undistilled ACE-Step 1.5 base DiT, set as
  `modelChoice` in the `generate_music` tool-config or `musicModel` when
  spawning. It needs a GPU and is the slowest. See
  [plugins/music](plugins/music/README.md). (#315)
- Plugin options for a spawned harness. `spawnHarness` and `harnessChild` take
  `pluginOptions: { speech?, mcp?: { servers? } }` (`HarnessPluginOptions`), so
  a sidecar host reaches MOSS and deferred MCP tools. See the
  [decision record](docs/decisions/2026-10-07-a-spawned-harness-takes-plugin-options-in-one-slot.md).
  (#322, #325)
- A spawned harness loads a third-party plugin. `@qvac/harness/sidecar`
  exports `HarnessSidecar`, the sidecar's boot, and
  `@qvac/harness/worker/harness-sidecar.mjs` exports `firstPartyPlugins`. A
  host stows its own entry with both and its plugin, whose options travel
  under its name in `pluginOptions`. See
  [a custom plugin](examples/custom-plugin/README.md#a-spawned-harness). (#359)

  ```js
  export default (ipc, ready) =>
    HarnessSidecar.start(ipc, ready, (ctx) => {
      const notes = ctx.pluginOptions.notes
      return [...firstPartyPlugins(ctx), ...(notes ? [new Notes(notes)] : [])]
    })
  ```

- Hooks reach further. New phases `promptSubmit`, `toolFailure`, `stop` and
  `preFold`; `HarnessHook.matcher` and `timeoutMs`; results
  `{ permission: 'allow' | 'deny' | 'ask' }`, `{ context }` and `{ halt }`
  (a `HookHalt` failure). `CommandHooks` runs the command hooks of a Claude
  Code `settings.json` as they are. See
  [plugins/command-hooks](plugins/command-hooks/README.md). (#260, #261)
- Approval quote. `ToolDefinition.quote(args, ctx)` returns the confirmation a
  person reads before an approvable call, such as its cost, and `ApproveFn`
  receives it as `quote`. (#183)
- Plans and goals. The agent knob `plan` offers `update_plan`, a checklist kept
  in the run; `planMode` refuses writes until a submitted plan is approved; and
  `goal: { objective, rounds?, ms?, tokens? }` keeps a run going until every
  step is done, emitting `goal` events whose `text` the host stores as a turn.
  See [Plans and goals](README.md#plans-and-goals). (#234, #240)
- `RunGoal.checksProve`. A host whose `checks` prove the goal sets it, and the
  goal is met once the plan is done and those checks pass, without asking the
  model for a check of its own. Without `checks` it has no effect. (#599)
- Steering. `CompletionContext.input` sends `steer` and `follow-up` turns to a
  running run, single or chained; each delivery emits an `input` event. See
  [Steer a run while it works](README.md#steer-a-run-while-it-works). (#186,
  #247)
- Fold. When the context runs short, older turns become one summary turn, and
  `fold` `{ phase: 'done', summary, throughId, foldedTurns }` tells the host
  what to store. It needs the new `ChatMessage.id`; a history without ids does
  not fold; a host with a fold of its own, as qvac-core, turns it off. See the
  [decision record](docs/decisions/2026-10-03-the-harness-decides-and-runs-the-fold.md).
  (#241) A run also folds its own earlier rounds after the last user turn,
  keeping the task, the latest plan, every `tool_search` and skill load and
  the last two rounds. A round cut off at `length` forces a fold before the
  next send, the wrap-up included. A fold of the run's own rounds emits no
  `fold` event, and each one costs one cold prime of the folded history. The
  wrap-up now carries `args.messages`, so in a multi-turn chat it can also fold
  the host's turns (`foldChat`) and emit a host `fold` event (`start`, `done`),
  at this new point in the run. See the
  [decision record](docs/decisions/2026-10-13-a-run-folds-its-own-rounds.md).
  (#446, #452)
- Exec output over `maxOutputChars` spills to a run-scoped file, and the marker
  names it for `read_files`, when the run has `read_files`. `deniedRootsFor`
  returns two roots, the storage root and the spill root. (#238)
- Run log. `RunLog.watch()` follows a run live as views or an inspector page,
  and `RunLog.requests(core)` rebuilds every request the model saw. See
  [examples/run-log](examples/run-log/README.md) and
  [Resuming a completion](docs/resuming.md). (#235, #236)
- `bun run example run-log` is one CLI that opens a run from its run log file
  or from the key of a run someone shares over Hyperswarm: `report` opens the
  run report in the browser, `inspect` prints the raw log (`--html` for a
  page, `--follow` to watch it grow), and `share` serves a run and prints its
  key. It replaces `examples/run-log/report.ts`, `view.ts`, `live.ts` and
  `inspect.ts`. (#408)
- `bun run example --report <file>` writes a run report page for each run an
  example makes (its run log when the file ends in `.json`). `bun run example
--share` prints a key first, then streams every run to it as it goes, so
  `run-log report <key>` or `run-log inspect <key> --follow` open it live.
  `run-log report --live` serves a live run report on localhost that updates
  in place, follows the newest step and run, and has a tab per run
  (`RunReport.live`, `RunReport.parts`). Each example parses its own args, and
  `bun run example <name> --help` lists them.
- Parallel. `ToolDefinition.concurrent` runs up to four opted-in reads of a
  round together (`read_files`, `grep` and `file_glob` opt in). `slots` (or
  `llm.slots` when spawned) lets one loaded model decode several completions at
  once. See [Parallel](README.md#parallel) and
  [examples/parallel](examples/parallel/README.md). (#193, #316, #333)
- `maxToolRounds` (default 10, in process and on the wire) sets a run's round
  limit. `wording` (`toolContinuation`, `toolDenied`, `toolCutOff`,
  `toolContextBoundary`, `toolRepeated`, `toolUnchanged`, `fileDelivered`,
  `goalContinuation`) sets its model-facing text, in process only. A run that
  wraps up after a delivered file ends with the `delivered` outcome. (#159,
  #240, #317, #450, #453, #463)
- Speed. `metrics` adds `rounds[]`, `tools[]`, `modelMs` and `toolMs`. See
  [Speed stats](docs/speed-stats.md). (#195) `metrics.outcome` names how the
  run ended (its `RunOutcome`), and `rounds[].overflows` counts the prefills
  the context overflowed before a round landed. (#442, #444)
  `rounds[].contextBoundary` marks a round cut at the context window (#450),
  and `rounds[].reasoningDeltas` counts its reasoning deltas, a cancelled round
  included (#461, #484). A cancelled round carries `rawContentChars` and
  `kind` (`streaming` or `wrap-up`). (#476, #480)
- `CompletionContext.budgetMs` sets one run's wall-clock budget, in process
  only. A goal's `ms` wins, and a resume keeps the budget the run started
  with. See the
  [decision record](docs/decisions/2026-10-13-run-time-budget.md). (#442)
- `CompletionContext.roundCut` hands the host a `cut(note)`
  that stops the tool round streaming now and keeps the run. The round's whole
  calls run, a call it may have truncated is answered with
  `wording.toolRoundCut`, and the note is the next user turn, acked by an
  `input` event. The second cut in a row ends the run as `mute`. The bench
  bridge cuts a round at its deadline instead of ending the run. See the
  [decision record](docs/decisions/2026-10-15-a-host-cuts-a-round-and-the-run-goes-on.md).
  (#462)
- `CompletionSdkResult.toolCallStream`, optional, streams a round's calls
  before `final`. With it, a round that streams one call 3 times or 32 calls
  is cancelled mid-stream. (#453)
- Model fit. `LoadedModel.fit` reports the engine's fit verdict, plan and bytes
  in `diagnostics().models` and `model` events, and `list()` rows of curated
  chat models not loaded carry `fit`, `fitBasis` and `fitEvidence`. A curated
  chat model with no set context steps down to 32768, 16384 or 8192 when its
  tier would not fit, and an embedding load that would not fit unloads idle
  chat models. `llmLoad` passes llama.cpp load knobs. See
  [Know how fast it is](README.md#know-how-fast-it-is) and
  [examples/model-residency](examples/model-residency/README.md). (#194, #196,
  #314)
- Tool replay. An assistant message may carry `toolCalls` and a `tool` message
  `toolCallId` and `name`, so a follow-up is answered from an earlier turn's
  results. Opt in; delete each chat's KV cache when it switches. See the
  [decision record](docs/decisions/2026-10-02-a-host-replays-tool-turns-the-harness-renders-them.md).
  (#169)
- Host building blocks. `Tools` from `@qvac/harness/tools` (`product`,
  `deniedRoots`, `bundledSkillsDir`, `stageInputs`); `credentialSlots` from
  `@qvac/harness/skill-manifest`; `@qvac/harness/addon-externals` with
  `deferredAddonPackages`; and an `outbound` option on `CompletionEngine`. See
  [Product tools and skills](docs/hosting.md#product-tools-and-skills) and
  [Install](docs/hosting.md#install). (#166, #228, #273, #283, #317)
- `grep` runs on the host that holds a hyperdrive. A `grantedDrives` entry with
  `search: true` gets a `search` op from `driveOp` and returns its hits inline,
  so file bytes never cross to the harness. The host answers it with
  `DriveSearch.answer(drive, request)`, where `drive` is the `Drive` its `list`
  op already serves: a shallow list yields each subdirectory as
  `{ key, dir: true }` and honours `skip`. Without the flag, `grep`
  streams the drive as before; a failed search is the tool's error, never a
  fallback. The host searches whole files, so results match streaming for
  files under 8 MB; a line over 1 MB is searched in its first 1 MB on either
  side. The regex runs in the host's process: a host that serves
  untrusted regex calls the helper from a worker. On a sparse replica the
  host still pulls the blocks from its peers. (#393)

  ```js
  import { DriveSearch } from '@qvac/harness/lib/tools/fs/search.ts'

  harness.completion({
    grantedDrives: [{ key, writable: false, search: true }],
    driveOp: (request) =>
      request.op === 'search' ? DriveSearch.answer(drive, request) : other(request)
  })
  ```

- A Node lane: `bun run test:node` runs the brittle suite under Node, and CI
  runs it beside the Bare lane. (#535)
- The types a host needs to serve a granted drive and to manage skills are
  exported from `@qvac/harness`: `GrantedDrive`, `DriveOpFn`, `DriveRequest`
  and each request it unions, `DriveResponse`, `DriveEntry`, `DriveDir` and
  `SearchHit`, and `ManagedSkill`, `SkillFileContent`, `CopyBaseResult` and
  `DeleteOverlayResult`. The contract already takes or returns each of them,
  but a host could only reach them through `./lib/tools/*`, which 1.0 no
  longer exports. (#591)

  ```ts
  import type { DriveOpFn, GrantedDrive, ManagedSkill } from '@qvac/harness'
  ```

- `grep` takes `output` (`content`, the default; `files`, the matching paths;
  `count`, per file), and `limit` and `offset` to page past a cut-off answer.
  A plain-text pattern can name alternatives as `a|b`, and a miss on a pattern
  that looks like a regular expression says to set `regex: true`. (#628)
- `edit_file` answers a miss with the file's closest lines, numbered as
  `read_file` shows them, so the next try can copy them; when the new text is
  already in the file it says the edit looks done. Old text copied with
  `read_file`'s line numbers matches without them. (#628)
- The coding plugin runs a shell line that only reads, such as `rg`, `grep`,
  `sed -n` or `cat` with files inside the shared folder, without asking. Each
  reader allows only flags known to shape output, and a run whose shell may
  have moved (an earlier line other than a reader, or a `cwd`) asks again.
  (#628)
- `generationParams.reasoning_rounds: 'plan'` thinks only where a plan is made
  or remade: after the user speaks and after a round whose call failed. (#628)
- A host that runs the sidecar names a module in `QVAC_HARNESS_HOST_MODULE`,
  an absolute path, whose `configureHarness(harness, log)` the sidecar calls
  after the user plugins load; a module that fails stops the sidecar.
  `QVAC_SDK_OPTIONS` names a JSON file of SDK options the sidecar adds to the
  SDK config it writes. The `drive`, `remote`, `remote-protocol` and five skill
  leaves under `@qvac/harness/lib/tools/` are exported for such a host. See the
  [decision record](docs/decisions/2026-10-25-a-host-shapes-the-harness-through-a-named-module.md).
  (#629)

### Changed

- A host reaches the drive protocol it serves, the skill catalog and the
  user-plugin import map through named entries: `@qvac/harness/drive`
  (`DriveRequest`, `DriveResponse`, `DriveEntry`, `GrantedDrive`, `DriveOpFn`,
  `MAX_DRIVE_BYTES`), `@qvac/harness/skill-catalog` (`loadSkillCatalog`,
  `availableSkills`) and `@qvac/harness/user-plugins` (`sharedImports`), and
  `@qvac/harness/skill-manifest` adds `readSkillSetup`. `test/entry-weight.ts`
  holds every named entry to a ceiling on the files importing it loads, so a
  host that imports a constant never parses the engine. (#636)

- Every host that runs python, on Bare or Node, recopies
  `patches/pyodide@314.0.2.patch` into its `patchedDependencies`. Guest Python
  sees: `ctypes` calls to `emscripten_run_script*` do nothing and return 0, a
  side module with `EM_JS` or `EM_ASM` is refused with `OSError`, `pyodide_js`
  holds only the allowlisted members, and `loadPackage` takes lockfile names
  only. A worker that boots an unpatched pyodide logs one line per process.
  (#567, #586)
- **Breaking:** a plugin's dependencies are optional peer dependencies of
  `@qvac/harness`, so installing the harness no longer installs any plugin's
  native addons or libraries. A host installs the peers of the plugins it
  imports; importing a plugin without them throws one error that names the
  plugin and the packages. The shipped sidecar entry composes speech, image,
  music, translation and python, so a host that spawns it installs their
  peers; a host that wants fewer writes its own entry. See
  [Plugin dependencies](docs/hosting.md#plugin-dependencies). (#626)

  | Plugin          | Peers                                                                  |
  | --------------- | ---------------------------------------------------------------------- |
  | `speech`        | `@qvac/asr-ggml`, `@qvac/tts-ggml`, `bare-ffmpeg`                      |
  | `image`         | `@qvac/diffusion-cpp`, `bare-image-resample`, `bare-media`             |
  | `music`         | `@qvac/audiogen-ggml`                                                  |
  | `translation`   | `@qvac/translation-nmtcpp`                                             |
  | `python`        | `pyodide`                                                              |
  | `quickjs`       | `@jitl/quickjs-singlefile-mjs-release-sync`, `quickjs-emscripten-core` |
  | `egress-proxy`  | `bare-net`                                                             |
  | `run-report`    | `elkjs`                                                                |
  | `walkie-talkie` | `hyperswarm`, `hypercore-crypto`                                       |
  | `sandbox-vm`    | `barevisor`                                                            |

  ```sh
  # before: the harness installed every plugin's dependencies
  npm i @qvac/harness
  # after: a host spawning the shipped sidecar entry
  npm i @qvac/harness @qvac/asr-ggml @qvac/tts-ggml bare-ffmpeg @qvac/diffusion-cpp \
    bare-image-resample bare-media @qvac/audiogen-ggml @qvac/translation-nmtcpp pyodide
  ```

- **Breaking:** `@qvac/sdk` and the model addons are optional peer
  dependencies of `@qvac/harness`, so installing the harness installs no model
  engine. Each belongs to the capability that loads it: on Bare, completion
  needs `@qvac/llm-llamacpp` and `@qvac/langdetect-text`, embeddings and the
  `knowledge` plugin need `@qvac/embed-llamacpp`; on Node every capability
  needs `@qvac/sdk`, which brings its own addons. A missing one throws where
  the capability loads, naming the capability and the packages; the harness
  entry imports without any of them. Speech and music add `@qvac/decoder-audio`
  to their peers, and translation and `language-hint` add
  `@qvac/langdetect-text`. The core and the plugins import the engine's
  plugins and model catalog from `@qvac/inference`, a dependency, not through
  `@qvac/sdk`. See [Model dependencies](docs/hosting.md#model-dependencies).
  (#630)

  ```sh
  # a desktop host on Node
  npm i @qvac/harness @qvac/sdk @qvac/llm-llamacpp @qvac/embed-llamacpp @qvac/langdetect-text
  # a phone app running completion on a Bare thread
  npm i @qvac/harness @qvac/llm-llamacpp @qvac/langdetect-text
  ```

- **Breaking:** `harness.detectLanguage` returns a promise, since it loads the
  detector on first use. (#630)

  ```js
  // before
  const [best] = harness.detectLanguage({ text })
  // after
  const [best] = await harness.detectLanguage({ text })
  ```

- `bare-worker` is pinned to 4.5.0 and `bare-module` is a dependency at
  `~7.1.0`, so a host's install resolves a `bare-module` that runs on Bare
  1.34: `bare-worker` 4.5.3 asks for `bare-module` 7.4, and npm gives it 7.5,
  which needs Bare 1.35. (#630)
- The `sandbox-vm` plugin (`VmShell`, `./plugins/sandbox-vm`) is back, with
  `barevisor` an optional peer instead of a dependency every host installed.
  (#626)
- Every skill-gated tool (`docx`, `pptx`, `xlsx`, `pdf`, `generate_image`, …),
  `http_request` and every MCP server's tools are deferred behind
  `tool_search`. The sent tool set is fixed per chat, so a skill load no longer
  re-primes the prompt cache: it appends the loads of the tools it grants. A
  direct call to a deferred tool loads it and runs in the same round instead of
  being refused. An MCP server sets `defer: false` to send its schemas whole.
  `skill-eval` gains `--defer`. (#566)
- **Breaking:** `engines.node` is `^22.21.0 || >=24.9.0`. A Node host outside
  that range crashed with `SIGSEGV` in `spawnHarness`; npm now warns at install.
  See [On Node](docs/hosting.md#on-node). (#553)
- **Breaking** for guest Python that imports from `js`: the `js` module holds
  only the names in `JS_GLOBALS`, and the python worker seals the `Function`,
  `AsyncFunction` and generator constructors after boot. `pyodide_js` holds
  only what pyodide's Python and micropip import, with no `FS` or
  `mountNodeFS`, and the pyodide patch turns the `emscripten_run_script*` and
  `EM_JS`/`EM_ASM` routes into no-ops or refusals. `pyodide.code.run_js` raises
  in the guest. See
  [the decision record](docs/decisions/2026-10-20-guest-python-sees-only-allowlisted-js-globals.md).
  (#554, #567)
- **Breaking** for a TypeScript host that reads it: `inference-sent` no longer
  carries `messages`. `@qvac/inference` 0.22 does not report the slice it
  pushed, so the field was always empty; a prompt inspector reads the payload
  from `inference-call` and the cached share from `tokens.cached`. (#557)
- **Breaking** for a host that injects an SDK through `HarnessOptions.sdkLoader`:
  `CompletionSdkResult` carries `events`, an `AsyncIterable` of the SDK's own
  `CompletionEvent`, in place of the deprecated `tokenStream`. The harness
  reads its `contentDelta` events as the reply text. (#510)
- **Breaking** for a caller that matches a fetch refusal as a `TypeError`:
  every plugin fetch refusal (the guarded fetch, the Python sandbox's, and the
  network-off and no-fetch refusals) is a `HarnessError('FETCH_REFUSED')`.
  Match with `instanceof` or the code. (#506)
- **Breaking:** `isHarnessError(err, name)`, `harnessErrorCode(name)` and
  `harnessErrorCodes()` from `@qvac/harness/errors` are the `HarnessError`
  statics `HarnessError.is`, `HarnessError.code` and `HarnessError.codes`.
  (#512)
- **Breaking:** the message constants `CONTEXT_OVERFLOW_MESSAGE`,
  `IMAGE_LOAD_STALL_ERROR`, `TRANSLATION_LOAD_STALL_ERROR` and
  `NO_STORAGE_ROOT` are `HarnessError` statics. `@qvac/harness/errors`,
  `@qvac/harness/plugins/image` and the fs scope module no longer export them.
  The package root keeps `CONTEXT_OVERFLOW_MESSAGE`. The text is unchanged.

  ```js
  // before
  import { IMAGE_LOAD_STALL_ERROR } from '@qvac/harness/plugins/image'
  if (result.error === IMAGE_LOAD_STALL_ERROR) retry()

  // after
  import { HarnessError } from '@qvac/harness/errors'
  if (result.error === HarnessError.IMAGE_LOAD_STALL_ERROR) retry()
  ```

  (#552)

- `SeatbeltSandbox.setup()` runs `/usr/bin/getconf DARWIN_USER_TEMP_DIR` and
  throws when it fails. A copy of the user's xcrun cache into a scratch `TMPDIR`
  that fails for any reason but a missing cache fails that exec call, or the
  workspace `open`. See the
  [decision record](docs/decisions/2026-10-14-seatbelt-seeds-tmpdir-with-a-copy-of-the-xcrun-cache.md).
  (#467)
- Identical calls in one round run once, writes included: two `echo x >> f`
  in one round append once. One tool turn worded by `wording.toolRepeated`
  tells the model. A runaway round, 3 repeats of one call or 32 calls, is
  cancelled on its calls. `<tool_call>` markup left in a round's content, as in
  a wrap-up or a frame the SDK did not parse, counts toward the same limits.
  See the
  [decision record](docs/decisions/2026-10-13-a-round-runs-each-call-once.md).
  (#453, #480)
- A response cut off by the length limit runs its complete calls; only the
  call the cut truncated is answered, and a truncated call to a tool that is
  not loaded is answered as cut. A cut at a `predict` cap gets
  `wording.toolCutOff`; any other `length` cut gets
  `wording.toolContextBoundary`, which says the context window filled before
  the arguments were complete. (#155, #450, #454, #458)
- With tools on, a prose round cut at the context window is retried with the
  history folded, or wrapped up, instead of answered with its fragment. A cut
  at a `predict` cap (`contextBoundary: false`), or a round with
  no tools, keeps the fragment. `round-reset` fires only when the round is
  retried or wrapped. (#456, #483)
- The round sets `contextBoundary` on every `length` stop: `true` at the
  context window, `false` at a `predict` cap. Every round, the wrap-up
  included, reads a stop flagged `false` as the output cap and any other
  `length` stop as the context window: a cut call gets
  `wording.toolContextBoundary`, a cut prose round with tools on is retried
  with a fold, a wrap-up answers with the fallback and emits `round-reset`, and
  `RoundSpeed.contextBoundary` is `true`. A stop flagged as the cap no longer
  makes the next round fold. (#450, #481, #485, #488, #647)
- A host that runs python on Node recopies `patches/pyodide@314.0.2.patch`
  into its `patchedDependencies`. Pyodide now loads `child-process-stub.cjs`
  by path, so guest `os.system` cannot spawn a process on Node either. A Bare
  host needs nothing: the old patch already gave it the stub. #554 later closed
  the `js` route to the host realm, and #567 changed the patch again for every
  host. (#535)
- A call whose result is the same as its last result in the run is not
  progress: its result carries `wording.toolUnchanged`, and 3 such calls send
  the run to the wrap-up with the `exhausted` outcome. A round whose sent
  history rewrote earlier turns (a fold, a ladder drop, a compaction) clears
  what the run settled, so a re-read after it is new. The result digest is
  keyed by the run key, so digests in run logs written before this change
  differ. See the
  [decision record](docs/decisions/2026-10-14-an-unchanged-result-is-not-progress.md).
  (#463, #464, #465)
- One call that returns the same result 4 times in a row ends the run in the
  wrap-up with the `exhausted` outcome, even when other calls progressed in
  between. The unchanged note counts the runs: `wording.toolUnchanged` replaces
  `{count}`. A goal run ends after this wrap-up with the new `GoalStatus`
  `stalled`, instead of taking another goal turn. See the
  [decision record](docs/decisions/2026-10-15-a-call-that-keeps-returning-the-same-result-ends-the-run.md).
  (#499)
- A new result from any call restarts the unchanged count of every call, and a
  result that prints nothing is never unchanged. An edit between two runs of one
  check no longer counts toward the stop. (#508)
- A goal can name `checks`, the commands its result is judged by. The goal is
  met only when the plan is done and the latest run of each check exited 0; a
  run that names the check in a call's `command` with only `&&` after it counts.
  Until then each goal turn names the checks not run yet and carries the output
  tail of a failed one, and a run that spends its budget with a check failing
  ends `rounds`, `time` or `tokens`, not `met`. The Terminal-Bench agent sends
  the verify scripts and test runners its instruction names that the container
  has, and returns `exitCode`, so a failing command is a failed call; its log
  rows keep `return_code`, and the report adds `checkerRan` and
  `checkerPassed`. (#530)
- A goal with no `checks` is no longer met on the model's word when the run
  offers a tool that takes a `command`. Before its first turn, and on each goal
  turn until it does, the model is asked to name the commands that prove the
  task done under a `Checks:` line; the first turn that names them sets the
  goal's checks, and the goal is met only once each ran and exited 0. A model
  that names none runs the goal to its budget. The Terminal-Bench agent, when
  its instruction names no check it can find, sends `test -s <path>` for each
  absolute path the instruction asks it to write. A `goal` event names the
  goal's checks in `checks` once it has some, the bench bridge's done frame
  carries them in `goal.checks`, and the Terminal-Bench trial row keeps them as
  `checks`. (#550)
- Breaking for hosts that send `checks`: passing host checks alone no longer
  meet a checkable goal. The model must name a check of its own under a
  `Checks:` line, and one that repeats a host check does not count. A host
  whose checks do prove the task, such as qvac-core, sets
  `goal.checksProve: true` (#599). (#595)
- A round of unchanged calls counts once toward the stop for runs with no new
  result, not once per call. Three such rounds in a row end the run, so one
  sweep of re-checks with nothing new no longer ends a goal run as `stalled`. (#509)
- A fold, a forced fold, a ladder drop or a compaction no longer restarts the
  unchanged count. A call that returns the same result and folds every few rounds
  now ends the run at its fourth identical run. The re-read after a fold carries
  no unchanged note and no progress credit. (#507)
- A wrap-up cut off at the context window answers with the fallback instead of
  its fragment and emits `round-reset` for what it streamed; a wrap-up
  cut at its `predict` cap (`contextBoundary: false`) keeps its
  text as the answer. The run's outcome does not
  change. The wrap-up sends `predict` as `reasoning_budget + 4096`; a host
  `predict` wins. (#452, #480)
- The bench bridge sends `thinkingDefault: 'enabled'`, so a model without a
  preset gets the 8192 reasoning cap. (#461)
- A wrap-up's answer no longer overwrites why the run wrapped: `hook:runEnd`
  and the persisted context keep `exhausted`, `time-capped` or `mute`. (#442)
- The default `goalContinuation` nudge says to mark a step done only once a
  tool result shows it, and to make the last step a check of the whole result
  with a tool. (#447)
- `exec` refuses an unterminated quote and `let`, `declare`, `typeset`,
  `local`, `export`, `readonly`, `read`, `unset` or `printf -v` given `$` or a
  backtick, whose subscript bash evaluates. With the network off it also
  refuses a program name the shell still expands, such as `{curl,x}`. (#390)

- **Breaking:** a `driveOp` host answers the new `recursive` field of a `list`
  request. With `recursive: false` it lists only the folder's direct children,
  each subdirectory as `{ key, dir: true }` in `entries`, and `skip` names a
  child to leave out. The walk behind `grep` and `file_glob` lists one
  directory at a time this way, so it never lists an ignored tree. (#391)

  ```js
  // before
  { op: 'list', driveKey, folder, skip, limit, cursor }
  // after
  { op: 'list', driveKey, folder, skip, recursive: false, limit, cursor }
  ```

- `grep` and `file_glob` skip what `.gitignore` and `.ignore` files exclude,
  and the `.hg`, `.svn`, `.venv`, `.cache` and `.next` directories, so an
  ignored build tree no longer fills the walk's entry cap. `includeIgnored: true`
  searches them too; `.git` and `node_modules` stay skipped. POSIX classes such
  as `[[:alpha:]]`, `.git/info/exclude` and global excludes are not read. (#391)
- `grep` searches raw bytes and decodes only the line around a hit, runs its
  queries as one regex, and reads up to 8 files at once; hits keep the walk's
  order and the match cap stops at the same hit. A trailing newline no longer
  adds an empty last line for `^$` or `.*` to match, a NUL in the first 1024
  bytes marks a file binary before any hit counts, and case-insensitive
  literals fold as the regex `i` flag does: ASCII as before, but the Kelvin
  sign no longer matches `k`. (#392)
- **Breaking:** `network: { mode: 'off' }` in the agent's or the run's policy
  replaces `sandboxMode`. It withholds the network toolsets and keeps exec,
  python, plugin fetches and external delegate targets offline, as before.
  A tool reads the compiled policy in `ctx.policy`, an exec shell in
  `ExecutionContext.policy`, and a `preToolCall` hook reads `ctx.network`.
  `agent-knobs.sandboxMode` stays on the wire, never read or written. (#388)

  ```js
  // before
  harness.completion({ model, messages, agent: { ...agent, sandboxMode: true } })
  // after
  harness.completion({ model, messages, agent: { ...agent, policy: { network: { mode: 'off' } } } })
  ```

- **Breaking:** `SeatbeltSandbox` takes only `{ sandboxExec }`. What a line may
  touch comes from the run's compiled policy, per call and at
  `SandboxService.open(dir, policy)`: the write grants (`files.write` only
  bounds them), `files.deny`, the network, and with the network off the listed `sockets`,
  `localhost` and `bind`; `env` drops names from the spawn allowlist. Its shell
  is named `seatbelt`. A provider declares `enforces` on its `ExecShell` or
  `SandboxService`, and the harness refuses a run whose policy one cannot hold
  before round 1: Seatbelt refuses a `files.read` list, a `hosts` network
  mode, and `localhost: false`, `bind: false` or `sockets` under `on`, and the host shell an `env` or `exec` list. `VmShell` holds any
  policy. `ExecutionContext.writeRoots` and `deniedRoots` moved into
  `ExecutionContext.policy`. (#388)

  ```js
  // before
  new Harness({
    exec: true,
    plugins: [new SeatbeltSandbox({ preset: 'workspace-write', network: false })]
  })
  // after
  new Harness({
    exec: true,
    policy: { preset: 'workspace-write' },
    plugins: [new SeatbeltSandbox()]
  })
  ```

- **Breaking:** plugins are an array of instances, and the harness builds
  `exec` from what they declare. `PluginEntry`, `{ plugin, config, read }` and
  the `config` argument of `validate` and `setup` are gone: options and the
  `read` grant go to the constructor. With `exec: true` and `sdkHome`, the
  harness builds `exec` from each plugin's `PluginSetup.exec`; two shells, or a
  host `exec` tool beside a contributing plugin, fail the start. (#269, #273)

  ```js
  // before
  new Harness({
    tools: [createExecTool({ deniedRoots, skillsDir, languages, routes }), ...tools],
    plugins: [
      { plugin: python.plugin },
      { plugin: weatherPlugin, read: ['weather_lookup'] },
      { plugin: imagePlugin, config: { model, clamps }, read: ['generate_image'] }
    ]
  })

  // after
  new Harness({
    tools,
    exec: true, // or { spawn, killProcess, realpath, policyVersion }
    skillsDir,
    sdkHome: sdkStorage.home,
    plugins: [
      new Python(),
      new ObsidianRoute({ credentialStore }),
      new Weather({ read: ['weather_lookup'] }),
      new Image({ model, clamps, read: ['generate_image'] })
    ]
  })
  ```

  `Speech`, `Weather`, `Image`, `Music` and `Knowledge` replace the
  `speechPlugin`, `weatherPlugin`, `imagePlugin`, `musicPlugin` and
  `knowledgePlugin` objects, and `Python` replaces `createPython()`.
  `ObsidianRoute`, `VmShell`, `SeatbeltSandbox`, `QuickJs` and `CodeMode` have
  no `.plugin` pair. `SeatbeltSandbox.name` is `sandbox-macos` (the label is
  `.shell.name`), `CommandHooks` takes `(hooks, { cwd })`, and `LspPlugin` and
  `ExternalAgents` take their options in the constructor.

- **Breaking:** these built-ins are now plugins. A host that builds `Harness`
  itself composes them; the bundled sidecar passes them all, so a
  `spawnHarness` host needs no change. See [Plugins](README.md#plugins).
  - Speech: `new Speech()`. Without it `transcribe`, `speak`, `speakStream` and
    a voice model load reject with `speech needs the speech plugin`. (#173)
  - Translation: `new TranslationPlugin()`. Without it `invoke` of `translate`
    errors. (#275)
  - Image and music: `new Image({ model, clamps })` and
    `new Music({ model: musicModelSet(choice), clamps })`. `HarnessOptions`
    loses `imageModel`, `imageClamps`, `musicModel` and `musicClamps`, and the
    tools sit in new `image` and `music` toolsets. (#175)
  - Weather: `new Weather({ read: ['weather_lookup'] })`.
    `createWeatherLookupTool` is gone, a refused fetch is a plain `{ error }`,
    and the 400 KB body cap is dropped. (#176)
  - Web search: `new WebSearchPlugin({ read: ['web_search'] })`;
    `Tools.product` no longer includes it. Its engines fetch through
    `ctx.fetch`, so a redirect to an undeclared host fails that call. (#276)
  - Obsidian: `new ObsidianRoute({ credentialStore })` with `exec: true`.
    `ExecToolOptions.credentialStore` is gone. (#223)
  - Python: `new Python({ loadPyodide, network })`. `createExecTool()` without
    `languages` runs shell lines only, and `disablePyodide`, `loadPyodide` and
    `pythonNetwork` are gone. (#174)
  - MCP: see Removed.

- **Breaking:** every module's entry exports one class and its types.
  (#216 to #221, #229)
  - `completion()` is `CompletionEngine.run(sdk, args, options)`, and the
    `./lib/capabilities/completion.ts` subpath is gone; its helpers and types
    are root exports, except `trustedSourcesFrom`.
  - `defaultHooks()` is `HookPipeline.defaults()`; `EgressGuardHook` and
    `SkillCatalogGuardHook` are statics of `HookPipeline`.
  - The contract type `Agent` is `AgentConfig`. `./agent` exports the `Agent`
    class: `resolveAgent` and `agentPolicy` are `Agent.resolve` and
    `Agent.policy`, and the other functions and constants keep their names as
    statics.
  - `createPluginRegistry(entries, options)` is
    `new PluginRegistry(plugins, options)`.
  - `./run-log` and `./run-log-inspect` export `RunLog`: `RUN_LOG_VERSION`,
    `RUN_LOG_PROTOCOL_VERSION`, `inspectRun` and `renderRunLogHtml` are
    `RunLog.VERSION`, `RunLog.PROTOCOL_VERSION`, `RunLog.inspect` and
    `RunLog.renderHtml`, and the engine-boot functions are statics.
    `./run-log` no longer exports the `Operation` and `RunBudget` types.
  - `./machine` exports `CompletionMachine` (`create`, `definition`,
    `emptyContext`, `VERSION`) and no longer re-exports the run log, the error
    classes, `tagError`, `rehydrateError`, the failure-result helpers or the
    stage payload types. The shared run types are root exports, and the
    `./lib/tool-call-display.ts` subpath is gone.
- **Breaking:** `@qvac/harness/plugins/speech` exports only `Speech` and its
  option types. `buildWavBuffer`, `packSamples`, `speakOnce`,
  `speakStreamOnce`, `transcribeStreaming`, `normalizeForSpeech`,
  `SPEECH_LEXICON`, `needsResample`, `resampleForTranscription`, `wavFormat`
  and `TARGET_SAMPLE_RATE` are internal; speak and transcribe through the
  harness. (#217, #312)
- **Breaking:** the translation catalog is static on `TranslationPlugin`, and
  the root no longer exports it: `NMT_TO_ENGLISH`, `NMT_FROM_ENGLISH`,
  `EURONANO_LANGUAGES`, `SLM_LANGUAGE_CODES` and `SLM_LANGUAGE_NAMES` are
  `TranslationPlugin.<name>`, and `translationPlanFor` is
  `TranslationPlugin.planFor`. `TranslationPlan` and `TranslationRefusal` come
  from `@qvac/harness/plugins/translation`. (#275)
- **Breaking:** a tool that reaches the network declares `egress(args)`.
  `HookPipeline.EgressGuardHook` checks every tool that declares it and none
  that does not, so a host tool named `http_request`, `web_fetch` or
  `mcp_call` without it loses the pre-call check. The v0.7.3 guarded-fetch
  exports have no public path; a plugin tool uses `ctx.fetch`. (#172, #224)
- **Breaking:** nothing a run does can load a new native addon: the sidecar
  seals addon loading once the harness is ready. A plugin or tool that imports
  a native addon lazily declares it in `HarnessPlugin.addons` or
  `ToolDefinition.addons`. A `QVAC_PYODIDE_WORKER_ENTRY` must exit when
  `workerData.preload` is true. See the
  [decision record](docs/decisions/2026-10-02-the-sidecar-seals-addon-loading-after-boot.md).
  (#177)
- **Breaking:** `SandboxWorkspace` gains `start(command, { cwd? })`, returning a
  `SandboxJob`, which a custom `SandboxService` must implement.
  `SeatbeltSandbox` declares `provides: ['sandbox']`, so it fails beside
  another sandbox provider. (#320, #329)
- **Breaking:** the run log records every model request as a `request` record.
  A host run-log codec that allows only known record types must accept
  `request`; `EngineOperationPort` gains `recordRequest`. (#235)
- **Breaking:** `CompletionEvent` gains `input-rejected`, and `HookPhase` and
  `HookRejection.phase` gain `promptSubmit`, `toolFailure`, `stop` and
  `preFold`; exhaustive switches handle them. Every steer and follow-up passes
  the `promptSubmit` hooks. (#260, #264)
- **Breaking:** `PreToolCallPayload.effect` and `.resource` are required; a
  host that calls `HookPipeline#runPreToolFold` itself passes both. (#183)
- **Breaking:** a plugin can own a skill's readiness through
  `PluginSetup.skills` (`SkillReadiness`), and the obsidian readiness moved
  into `ObsidianRoute`. `SkillStateInputs.obsidianProbe` and the
  `credentialStore` option of `createSkillTool` are gone, the core shares no
  credential key by default, and `versionProbeSkills` takes
  `{ installedTools, platform, readiness }`. (#227)
- **Breaking:** `Tools.stageInputs` and `ExecInput` come from
  `@qvac/harness/tools`, no longer `./plugins/python`, and
  `ExecLanguage.validate` takes an `ExecValidateScope`. (#317)
- **Breaking:** `MAX_TOOL_ROUNDS`, `TOOL_CONTINUATION_NUDGE`,
  `TOOL_DENIED_MESSAGE` and `TOOL_CUT_OFF_MESSAGE` come from
  `./lib/capabilities/tool-turns.ts`, not `lib/machine`, and
  `CompletionMachine.emptyContext` requires a `policy`. (#159)
- **Breaking:** the completion graph has no skill states: a skill preload runs
  as a generic prepare step. Context `skills` is `activated`, `skillPreload` is
  `prepareStep`, `tools.loadingSkill` is gone, and `ToolExecutionSnapshot` has
  `origin` in place of `kind: 'skill'` and `skillName`. (#170)
- **Breaking:** `resolveScriptRun` returns `{ args, trusted: false }` for a
  call that is not a script run, and is no longer exported. (#163, #174)
- **Breaking:** `metrics.durationMs` and the `runEnd` hook's `stats.durationMs`
  are the run's wall time, not decode time, and `promptTokensPerSecond` is
  weighted over every round. (#195)
- **Breaking:** `CompletionMachine.VERSION` and `RunLog.VERSION` are 1 until
  1.0.0 ships. A run saved with `1.0.0-rc.0` or `1.0.0-rc.1` does not resume,
  and `./run-log-inspect` no longer reads v4 or rc logs. (#205)
- **Breaking:** a run paused before the upgrade does not resume when its
  policy or hook identity changed: exec calls (#174, #178, #223), `delegate`
  calls with external targets (#319, #328), `web_search` calls (#276), runs
  past a pre-tool hook (#183) and runs under the obsidian hook (#227).
- **Breaking:** the contract types match `Harness`. (#353)
  - `ChatMessage.attachments` was `{ path: string }[] | null` and is now
    `{ path: string }[]`; omit it instead of sending `null`.
  - A contract context's `signal` was a structural
    `{ aborted?, addEventListener?, removeEventListener? }` and is now
    `bare-abort-controller`'s `AbortSignal`. A host that passes a global
    `AbortSignal` types its input as `HostContext<CompletionContext>` (the
    signal alone is `HostSignal`); `RemoteHarness` and `HarnessClient` take a
    `HostContext`.
  - `HarnessContract.on`/`off` took `'model' | 'status'` with
    `(...args: never[]) => void` and now take `'model'` with
    `(state: ModelState) => void`; the `'status'` event is gone.
- `bare-process` moves to 4.5.1, which adds the native addon `bare-posix`.
  (#178)
- The plugins' addons follow the SDK's peer ranges, and
  `collectRuntimeClosure` follows the per-platform `@qvac/fabric-<os>-<cpu>`
  packages. (#302)
- A chat with no system message no longer gets
  `'You are a helpful assistant.'`; every completion modelId changes once.
  (#194)
- Each chat's first turn after the upgrade misses the prefix cache once: tool
  descriptions spell out nested fields (#157), the exec schema reorders with
  Python (#174), and `web_search` and `mcp_call` move after `exec` (#276,
  #277).
- `tools()` waits for `ready()`, and `toolNames` and `diagnostics()` list
  plugin tools only after it. Plugin service registration rejects `undefined`
  and names reserved by the context, and `HarnessPlugin` is the only plugin
  shape. (#171)
- Long tool output keeps its first and last `maxOutputChars`, joined by a
  marker counting what was dropped, instead of ending in `… [truncated]`.
  (#180)
- `exec` refuses a `language` that no composed language claims, instead of
  running it as a shell line. (#232)
- A translation pack is freed on the idle sweeps instead of staying resident.
  (#275)
- Arg repair converts a string argument to the schema's scalar type when the
  conversion is lossless, so a tool may receive `3` for `"3"`. (#156)
- The exec approval labels inline Python as `python[ · network: …]: …`, and
  `command` with `script` is rejected. (#163)
- A round whose only tool calls were malformed gets one re-ask carrying each
  error. (#190)
- The narrated and malformed-call re-asks force a call with
  `tool_choice: 'required'`. `LlmGenerationParams.tool_choice` admits
  `'required'`; do not set it for a whole run, or the wrap-up fails. Narrated
  intent counts in the last two sentences of a reply's last paragraph. (#191,
  #213, #455)
- Reasoning that is on is capped at 8192 tokens a round instead of running
  unbounded: the presets and `agent.reasoning: 'enabled'` send that cap where
  they sent `-1`. `LlmGenerationParams.reasoning_budget` takes `-1`, `0` or a
  positive token cap, and a host's `generationParams` still wins, so `-1` lifts
  the cap. `'inherit'` still sends nothing. (#440)
- The `pdf` tool declares `bare-pdfium` in its `addons`. (#317)
- **Breaking for hosts:** a skill named with `@` or in prose reaches the model
  as it did in 0.8.7 (#374): the user's turn as typed, then a `skill` call
  (`preload-<name>`), its body as the result and the continuation nudge, not
  written into the user's message. The run stays on the chat's KV cache key, so
  its rounds and the turn after it read the cached prefix, and the preload no
  longer opts its run out of the cache. The host must replay each run's turns as
  it sent them (`@qvac/core` does from 0.7.0, tetherto/qvac-core#338): a host
  that collapses a run to its request and answer leaves the cache's message
  count stale, and the next turn's whole history is appended to the cache
  again. The load is reported on every mention, not once per chat, so a replay
  holds the turns the run sent; an edit to the skill reaches the chat on its
  next mention. A host that groups a run's events by `round` still puts the
  preload with round 0's calls: the harness renders it as its own round first.
  A skill that fails to load is noted in the user's turn, sends no call, and
  that run is not cached. (#511)

### Removed

- The eight file exports 1.0.0-rc.7 added for hosts:
  `./lib/tools/fs/drive.ts`, `remote.ts` and `remote-protocol.ts`, and
  `./lib/tools/skills/skill-state.ts`, `credential-slots.ts`,
  `manifest-parse.ts`, `overlay-crud.ts` and `scope-key.ts`. Import
  `@qvac/harness/drive`, `@qvac/harness/skill-state` (`SKILL_STATE`,
  `isDeviceSharedCredentialKey`), `@qvac/harness/skill-manifest`
  (`credentialSlots`, `readSkillSetup`), and the `ManagedSkill` and
  `SkillFileContent` types from `@qvac/harness`. (#636)

- **Breaking:** `harnessLogEnabled` from `./lib/log.ts`: use
  `HarnessLog.enabled(level)` or `HarnessLog.level()`. (#471, #506, #532)
- **Breaking:** `./lib/log.ts` exports the `HarnessLog` class in place of the
  free functions it had in 1.0.0-rc.2 and rc.3: `setHarnessLog`,
  `setHarnessLogSink`, `hlog` and `hdiag` are `HarnessLog.enable`,
  `HarnessLog.setSink`, `HarnessLog.info` and `HarnessLog.diag`. The root
  names keep working. The `HarnessLog` type, an interface for the
  `harnessLog` object since 0.8.10, now names the class: annotate a value with
  `typeof HarnessLog`. (#532)

  ```js
  // before
  import { hlog, setHarnessLogSink } from '@qvac/harness/lib/log.ts'
  setHarnessLogSink(sink)
  hlog('open')
  // after
  import { HarnessLog } from '@qvac/harness/lib/log.ts'
  HarnessLog.setSink(sink)
  HarnessLog.info('open')
  ```

- **Breaking:** `Tools.product` no longer offers `mcp_call` or the skill
  catalog's mcp operations (`notion_create_page`, `notion_insert_content`).
  Use `new McpPlugin({ generic: true })` with the same `skillCatalog` and
  `credentialStore`, and `read: ['mcp_call']`. (#277)
- **Breaking:** the `./lib/tools/*` wildcard export and the tool factories
  `createHttpRequestTool`, `createWebFetchTool`, `createSkillTool`,
  `createMcpCallTool` and `createWebSearchTool` are gone. Use `Tools.product`
  (with `skillsDir` for `skill`), `McpPlugin` and `WebSearchPlugin`.
  `credentialSlots` comes from `@qvac/harness/skill-manifest`,
  `ensureBundledSkillsDir` is `Tools.bundledSkillsDir()`, and
  `isDeviceSharedCredentialKey` comes from `@qvac/harness/skill-state` (a
  plugin declares its own in `SkillReadiness.deviceSharedKeys`). Only `./lib/tools/exec.ts`,
  `./lib/tools/toolsets.ts`, `./lib/tools/skills/index.ts`, `mention.ts` and
  `mention-name.ts` keep their keys. (#273, #283)
- **Breaking:** `./plugins` no longer exports the contract types: import
  `AddonLoaders`, `ExecLanguage`, `ExecRoute` and `ExecShell` from the root.
  (#284)
- **Breaking:** the `./docx` export is gone; read a `.docx` with
  `extractOfficeText` from `@qvac/harness/office`. (#269)
- **Breaking:** `lib/team`, `Team`, `TeamConfig`, `TeamRequest`, `TeamHost` and
  `TeamEvent` are gone; pass `agents` to `harness.completion()`. (#233)
- **Breaking:** `rag_search`, `ragSearch` (on `CompletionArgs`,
  `CompletionContext` and `ToolExecuteContext`), `RagSearchFn`,
  `RagSearchResult` and `./lib/tools/rag-search.ts` are gone; knowledge reaches
  the model by injection. (#162)
- **Breaking:** the module-level `harnessHooks` array is gone; pass
  `new Harness({ hooks: [...HookPipeline.defaults(), mine] })`. (#158)
- **Breaking:** `./lib/capabilities/tool-selection.ts` and `tool-names.ts` are
  `@qvac/harness/agent` (`Agent` statics). `isSelected`, `skillsAreSelected`,
  `MCP_CALL_TOOL_NAME`, `ToolGrant`, `ToolGrantSource`, `ToolGrants`,
  `SelectableTool` and `ToolGateInputs` are no longer exported. (#165, #206)
- **Breaking:** `./lib/tools/model-args.ts` (`unquoteArg`) is gone, with no
  replacement. (#166)
- The sidecar bundle no longer ships `@qvac/ocr-ggml`, and ships only the
  addons the bundle defers. (#226)
- **Breaking:** `skillPreloadMessage` and `withoutSkillLoadTurns`
  (`lib/capabilities/tool-turns.ts`). Nothing writes a skill body into the
  user's message any more, so no earlier load turn is dropped to keep the two
  from contradicting each other. (#511)

### Fixed

- A user plugin loads from the published package: `sharedImports` resolved the harness's own
  files by their `.ts` names, which the compiled `dist-lib` does not ship, so every host that
  loads user plugins from npm failed with `MODULE_NOT_FOUND`. It now names them with its own
  extension, and a test keeps shipped code from resolving its files by a `.ts` name.
- A host needs neither `@qvac/sdk` nor a patch of `@qvac/inference`. The
  published types import `@qvac/inference`, so a Bare host type-checks
  without the SDK or a `tsconfig` path, and the round tells a `length` stop at
  the context window from one at a `predict` cap from the `predict` it sent.
  A host drops its copy of `patches/@qvac%2Finference@0.22.0.patch`; one that
  keeps it sees the same behaviour. (#647)

- A message keeps the wire layout 0.8.13 shipped: `sentAt` is its fourth
  field again, ahead of `toolCalls`, `toolCallId`, `name`, `id` and `context`.
  Up to rc.6 a 1.0 harness could not decode a message from a 0.8.13 host that
  carried a send time. A host built against an earlier 1.0 rc must be rebuilt
  with this one, since those fields moved. (#623)
- The wrap-up round a run ends on keeps the tool block in the prompt and
  forbids a call with `tool_choice: "none"`, instead of dropping the block.
  Under `@qvac/sdk` 0.22 the dropped block rewrote the chat's one cache file,
  so that round and the next turn each re-read the whole chat (19.6 s to first
  token on Qwen3.5-2B after a 12-turn chat). (#605)
- A `skill` call that names a skill by its display name, in another case, or by
  the one tool it grants (`pptx`) loads that skill. (#528)
- On Node, the Python plugin finds pyodide and the vendored wheels without
  `import.meta.asset`: it resolves both with `import.meta.resolve`. (#535)
- A skill's tools are reselected on the turn the skill loads, so a run
  resumed after a skill load no longer fails with
  `Tools changed since this run paused`, and a resumed run hashes the system
  turn it sent. (#516)
- On Linux and Windows, a `Harness` made in the host's own process no longer
  relaunches the host's entry with `--gpu-probe`, which ran the host program a
  second time and held each first model load for 5 seconds. Only an entry that
  imports the probe hook first, as the sidecar entries do, is relaunched; any
  other reads its memory budget from `nvidia-smi`, `rocm-smi`, sysfs or the
  registry. (#539)
- An aborted run's metrics count the round the abort stopped: it is in
  `rounds[]` with `stopReason: 'cancelled'`, and the metrics event's
  `stopReason` is `cancelled`. See [Speed stats](docs/speed-stats.md). (#476,
  #479)
- `serveHarness(ipc, new Harness(...))` compiles with no cast: a `Harness` is a
  `HarnessContract`. `ChatMessage.attachments` no longer takes `null`, and the
  contract's contexts take a bare `AbortSignal`; `RemoteHarness` and
  `HarnessClient` still take any host signal (`HostSignal`). (#353)
- A reply that says it will act but asks the user something ends the turn,
  instead of a forced round making up the answer. (#252, #272, #292)
- Under `SeatbeltSandbox`, a shell line can no longer read or write the app
  storage root, and `SeatbeltSandbox.profile` takes
  `(policy, { roots, denied, ancestors })`. (#293)
- Under `SeatbeltSandbox`, the `/usr/bin` xcrun shims (`git`, `python3`) no
  longer run `xcodebuild` on every call when full Xcode is selected. Each call's
  and each workspace's `TMPDIR` starts with a copy of the user's xcrun cache, and
  a lookup that misses is saved to the copy only. (#467)
- A call to a skill name the turn does not have is refused with the names of
  the skills shown that turn (`The skills are: weather, ...`), so a small model
  loads one by its exact name instead of guessing. With no skills list shown,
  the refusal is unchanged. (#473)
- On Node, reaching the SDK no longer fails with `Bare is not defined`: the
  core and the speech, translation, image and music plugins leave SDK plugin
  registration to the SDK's own Bare worker. (#362)
- On Node, exec's default shell no longer fails every command with
  `require.addon is not a function`. (#274)
- On Node, a shell line under `SeatbeltSandbox` no longer fails with
  `require.addon is not a function`. (#281)
- A completion event the hrpc schema cannot encode ends the run with an
  `error` event instead of killing the harness process. (#267)
- `modelEvents`, `download`, `speakStream` and host `completion` frames that
  cannot encode report an error instead of killing the process. (#278)
- `copyAddonExternals` ships a dependency nested under a package when the root
  copy is out of its range. (#228)
- On the last tool round, an empty response wraps up instead of re-asking one
  round past `maxToolRounds`. (#167)
- A `FAIL` sent while a run was finishing no longer runs the finishing step and
  its `runEnd` hook again. (#167)

## [0.8.12] - 2026-10-21

### Added

- A custom GGUF the catalog does not know is sized by the engine fitter from
  its header and tensor list, so its preview gives a fit verdict instead of
  "Fit unknown". Split models stay unknown. (#562)

### Changed

- `http_request`, `mcp_call` and every skill-gated tool (`docx`, `pptx`,
  `xlsx`, `pdf`, `generate_image`, `weather_lookup`, compiled skill operations,
  …) are deferred behind `tool_search`: their schemas stay out of the prompt
  until searched, called or loaded with their skill. The tool set is fixed per
  chat, so a skill load no longer re-primes the prompt cache. `skill-eval`
  gains `--defer`. (#566)
- `@qvac/sdk` and `@qvac/inference` move to `^0.22.0`. Loads are sized on the
  fitter's `floorBytes`, so more models fit under a memory cap before one is
  unloaded. (#564)

### Fixed

- A model name that is not an exact catalog or registry name never resolves
  to a vision projector (`QVAC_MODEL=Qwen3.5-4B` loaded the `mmproj` file and
  failed to initialize). (#551)
- The device `thinkingDefault` reaches the Qwen3.5 presets, so turning
  thinking off works for 2B and 4B when the agent inherits. (#548)
- A GGUF header read that drops its connection, or gets a 408, 429 or 5xx, is
  retried up to 3 times, and each failure is logged with its host and cause.
  Add no longer fails after a good preview on a flaky CDN. (#561)
- A GGUF that names no architecture is no longer offered as a chat model: in
  an `sd.cpp` repo it reads as image generation, otherwise it is refused as
  `not-a-model`. (#529)
- Small models read an attached PDF with `pdf` instead of `web_fetch` on a
  made-up link, and a text-less page the host already rendered as an image is
  pointed at that image instead of "no OCR here". (#525)
- A `pptx`, `docx` or `xlsx` call that builds a new file without `output` is
  saved and attached instead of refused. The file is named after
  `create.title` (`Climate Change` → `climate_change.docx`), or
  `presentation.pptx`, `document.docx` or `workbook.xlsx` without one, the way
  the `pdf` tool names a new PDF. A 2B model often left `output` off, and the
  refusal sent it guessing attachment ids until the turn ended with no file.
  A call whose ops only read (`read`, `sheets`, `paragraphStyles`, …) returns
  their results and saves nothing, so it never attaches a blank file.
  (QVAC-26944)
- A new Word document takes two more of a small model's slips instead of
  refusing the whole call: a block position past the end of what the call has
  built so far lands at the end, and `appendParagraphs` with an `at` inserts
  the paragraphs there. An attached document keeps the strict checks. In any
  `pptx`, `docx` or `xlsx` call, an `{ "op": "output", … }` entry is dropped
  instead of refused, and a file name in it names the file unless `output` is
  already set. (QVAC-26944)
- In Obsidian vault folder mode, "what's in my vault" lists the notes with
  `obsidian files` instead of passing the vault folder to `read` or guessing
  commands, and a `read` that still names a folder is told to list it with
  `obsidian files` instead of failing with a raw file system error.
  (QVAC-27069)

## [0.8.11] - 2026-10-16

### Fixed

- A skill CLI call the schema rejects names what the command accepts: an
  `unknown parameter`, `unknown flag` or `unexpected argument` error now ends
  with the node's parameters or subcommands, e.g.
  `unknown parameter "title"; create takes: name, path, …`. The message
  prefixes are unchanged. (#523)

## [0.8.10] - 2026-10-16

### Added

- Harness log lines carry a level, `error`, `warn`, `info` or `debug`, and run
  on `@qvac/logging`. A sink set with `setHarnessLogSink` receives the level as
  its second argument, `(line, level) => …`, and `harnessLog`,
  `setHarnessLogLevel` and the `HarnessLog` and `LogLevel` types are exported.
  `hlog` keeps working and logs at `info`. (#471)
- `@qvac/harness/errors`: every runtime failure the harness detects throws a
  `HarnessError`, a `@qvac/error` error with a code in 102001–104000, and its
  message is unchanged. `isHarnessError(err, name)` matches the code, also once
  bare-rpc has turned it into a string, and `harnessErrorCode(name)` and
  `harnessErrorCodes()` give the numbers. A code reaches a host on a unary RPC
  call; completion, model and download events still carry only the message.
  (#472)

### Changed

- `QVAC_LOG_LEVEL` (the app's `--log-level`) now filters harness lines too. At
  `info`, round stats and `sdk tool definitions`, which are `debug`, leave
  `harness.log`. With it unset, an enabled log keeps every line, as before.
  (#471)
- The `logger` a host passes to `spawnHarness` or `harnessChild` sets harness's
  log level, in the sidecar's `harness.log` as well as in the host's process,
  when it has `getLevel()`; `QVAC_LOG_LEVEL` still wins when set. The lines
  harness writes in the host's process go to that logger at their level, not to
  stdout, whose unread pipe can halt Bare on Windows. A sink set with
  `setHarnessLogSink` still takes them first. (#471)
- **Breaking** for a caller that reads `.name`: `AbortedError`, `TimeoutError`,
  `AbortError`, `JsonParseError` and `DriveReadTruncatedError` now extend
  `HarnessError` and carry its registry name (`AbortedError` is `ABORTED`,
  `TimeoutError` is `FETCH_TIMED_OUT`), and the Python sandbox's
  `fetch refused: …` errors are no longer `TypeError`s. Match with `instanceof`
  or the code. (#472)
- **Breaking** for a host that names file tools: with a folder grant, ten
  flat tools replace `read_files`, `file_glob`, `grep`, `create_documents` and
  `edit_documents`: `read_file`, `list_dir`, `glob`, `grep`, `write_file`,
  `edit_file`, `move_file`, `copy_file`, `make_dir` and `trash_file`. Each call
  names one file with plain string arguments, and `grep` takes one `pattern`
  instead of `queries[]`. A relative path resolves inside the shared folder,
  the first read grant or else the first write grant, and a write outside the
  write grant is refused. `read_file` numbers its lines, takes a range, caps a
  read at 20,000 characters and reads PDF, Word and PowerPoint as text.
  Creating a file, `copy_file` and `make_dir` run unprompted; overwriting,
  editing, moving and trashing ask first, and `trash_file` moves the file into
  the folder's own `.trash`. All ten belong to the `files` toolset. A host that
  labels, groups or describes tools by name needs the new names; old
  tool-activity records keep the old ones. A run without a folder grant sends
  the same prompt as before. (#490)
- `@qvac/sdk` is `^0.21.0`, not `0.21.0`, so a host resolves the newest 0.21.x
  patch. (#520)

### Removed

- **Breaking:** the `lib/tools/read-files.ts`, `file-glob.ts`, `grep.ts`,
  `create-documents.ts` and `edit-documents.ts` subpaths, which `./lib/tools/*`
  exposed. Their tools left the sidecar in #490; the new ones are under
  `lib/tools/files/`. (#491)

## [0.8.9] - 2026-10-15

### Changed

- A skill with a `display_name` answers only to that handle; a skill without
  one still answers to its folder name. `@documents` resolves the word skill
  and `@word` no longer does, which replaces the 0.8.8 note that both resolve.
  Implicit preload skips a leading `@name`, so a handle that resolves to no
  skill loads nothing, while a plain "make an excel sheet" still preloads
  Spreadsheets. A paired device on an older app build still sends `@word` and
  `@excel`; once the skills package declares `display_name`, a host on this
  version answers those requests without the skill. (#505)
- `@qvac/skills` 0.1.15: the Word and Excel skills declare `display_name`, so
  their handles are `@documents` and `@spreadsheets`. The browser skill hands a
  CAPTCHA, interstitial or login page to the user instead of clicking through
  or waiting, and keeps its Chrome cookies and logins across chats. (#513)

## [0.8.8] - 2026-10-15

### Added

- A skill's manifest may declare `display_name`, the `@` handle users see and
  type, as one word (letters, digits, `-` or `_`); a `display_name` that is
  not one word is ignored. The Word and Excel skills are shown as Documents
  and Spreadsheets, and their folder names are trademarks, so a host needs a
  handle other than the name. Once the word skill's manifest declares
  `display_name: Documents`, `@documents` resolves it, and `@word` still does,
  so an app that sends the folder name keeps working. The catalog entry and
  the `skills` wire carry `displayName`, a customized copy of a skill keeps
  the shipped one, and `skillMentionHandle` gives a host the same rule the
  harness matches on. The folder name stays the skill's key everywhere else.
  (#469)

### Fixed

- A replayed tool call keeps its markup when history is rendered from scratch.
  Every assistant turn lost its tool-call markup on the way in, so a retry,
  compaction, a dropped chat cache, an overflow candidate or another device
  showed the model an empty assistant turn followed by a result answering
  nothing. Only an assistant turn that no tool result follows is stripped now,
  which still keeps markup leaked into a final answer out of the prompt. (#402)
- A web search the harness runs for "search the web" now ends on the same
  continuation nudge as a search the model makes. Without it, the round after
  the search often failed on Qwen3.5-9B with thinking on instead of answering.
  (#486)
- An identical call to a read tool that already succeeded this turn is
  answered with a note pointing at the earlier result instead of running
  again, and counts as a strike. A small model could repeat the same call
  hundreds of times in one round until the context filled. Any other tool
  that runs clears the memo, and a round is cut to its first 16 calls. (#377)
- Asking the `skill` tool for a file a loaded skill does not have returns
  guidance listing its real files instead of an error, so the app no longer
  shows a failed tool call for it. A file asked of an unknown skill returns
  `skill not found`. (#383)

## [0.8.7] - 2026-10-12

### Added

- A skill's manifest may declare `env`, the variables its `exec` commands run
  with. The child process env is an allowlist, so this is the only way a
  skill's binary sees a setting of its own. The value `${session}` expands to
  the chat the run belongs to, which lets a long-lived tool such as a browser
  daemon keep one instance per chat; a run with no session drops that variable.
  An overlay skill keeps the base skill's `env`, so an edit never widens what
  a command can reach. `completion()` takes an optional `session`, in process
  and over hrpc, and falls back to the first segment of `cacheKey`. (#341)

  ```yaml
  metadata:
    env:
      AGENT_BROWSER_SESSION: '${session}'
      AGENT_BROWSER_HEADED: '1'
  ```

- A verb in a skill's `cli.schema.json` may carry `x-max-output-chars`, the
  most output `exec` returns for that command. The ceiling wins over the
  model's own `maxOutputChars`, the truncation note says which limit applied,
  and a schema whose cap is not a positive integer fails to load. Page
  snapshots and other verbose read verbs stay inside the context this way.
  (#342)

- The `browser` skill ships with `@qvac/skills` 0.1.14: an agent drives a
  Chromium through the `agent-browser` CLI, scoped to `exec(agent-browser)`,
  with one browser session per chat. (#405)

- A chat model's context climbs as far as the device and the SDK allow when
  neither the agent nor the host sets one: 262,144, then 131,072, then 65,536,
  before the default. The device class caps the climb, the trained window from
  the weight's GGUF header bounds it, and each rung must pass `assessModelFit`
  with its own config. The choice is kept per pool key for the life of the
  process. See the
  [decision record](https://github.com/tetherto/qvac-harness/blob/v0.8.7/docs/decisions/2026-10-08-the-device-class-sets-how-far-the-context-climbs.md).
  (#382)

### Changed

- **Breaking for hosts:** a skill named with `@` or in prose now reaches the
  model as a `skill` call, its result and the continuation nudge right after the
  request, exactly the round a load the model makes itself leaves, instead of
  being written into the user's message. The user's turn is sent as typed and
  the run stays on the chat's KV cache key, so its rounds and the turn after it
  read the cached prefix; the child key 0.8.6 ran these turns under (#305) and
  its delete are gone. The host must replay each run's turns as it sent them
  (`@qvac/core` does from 0.7.0, tetherto/qvac-core#338): a host that collapses
  a run to its request and answer leaves the cache's message count stale, and
  the next turn's whole history is appended to the cache again. Because the body
  is replayed as sent, an edit to the skill reaches such a chat on its next
  mention of the skill, not on the next turn.

- `bare-stow` 0.1.7, with the patches it made stale dropped. (#396)
- `lunte` 1.8.6 and `lunte-plugin-qvac` 0.2.0. (#397)

### Fixed

- **Breaking:** a skill switched off on the agent can no longer be used. Naming
  it with `@` or in prose loads nothing and unlocks nothing, and a chat that
  loaded it earlier loses it as soon as it is switched off (QVAC-25357).
  `skillIsActive` reads the agent's `enabledSkills` alone, and
  `SkillActivation` drops its `mention` and `loadedSkills` fields. A host that
  relied on a mention to grant a skill must enable it on the agent first. (#338)
- A round that says nothing and calls nothing is re-asked on a history that
  keeps that round's turn. The re-ask used to resend the history without it,
  which the SDK, having cached the turn, read as stale: it sent the whole
  history again and the addon appended it to the KV cache. (#403)
- A model loaded by hand when nothing else is in memory is no longer refused,
  even when its estimate is above the memory cap. Beside another model a
  manual load is still refused, so it never piles a second model into memory.
  (#394)

- When llama.cpp overruns its grammar mid-round and a complete
  `<function=…></function>` call has already streamed, the round ends on that
  text and markup recovery runs the call, instead of the turn failing with
  "Unexpected empty grammar stack". The held-back prose is flushed before any
  rethrow, and the inference inspector reports the recovered round as
  `completed` with the grammar error as its `reason`. (#370)

- `@mention`s, the implicit skill preload and the explicit web-search check
  read the turn as the user typed it (`CompletionContext.said`, carried in the
  start frame's existing payload), so a host that rewrites the stored turn no
  longer hides a mention. Hosts that do not send `said` behave as before.
  (#372)

- Office files keep their pictures off the text: in a deck a picture fills an
  empty placeholder, sits below the text when there is room, and otherwise
  takes the right half; an op aimed at a slide a later `addSlide` creates is
  refused rather than moved. In a workbook `addImage` without a `cell` lands
  beside the data, as `addChart` does, and a second picture or chart stacks
  below the first. A nested op is named as its own entry in a tool error, and
  the tool result says when an attached image went unused. (#406)

### Removed

- **Breaking:** `skillPreloadMessage` (`lib/tools/skills/mention.ts`) and
  `withoutSkillLoadTurns` (`lib/capabilities/tool-turns.ts`). Nothing writes a
  skill body into the user's message any more, so no earlier load turn has to
  be dropped to keep the two from contradicting each other.
- `CompletionSdk.deleteCache`. Nothing calls it now that the child key (#305)
  and the chat-cache drop after a model-loaded skill (#373, reverted in #400)
  are gone.

## [0.8.6] - 2026-10-08

### Added

- `setModelMemoryCap(percent)` keeps several models loaded side by side. Loaded
  models may fill that share of the device's memory budget, so chat models a
  request loaded stay loaded while they fit, and a chat switching between them
  loads neither again.

  A load that would not fit unloads idle models one at a time, least recently
  used first within each group: image and music models first, then embedding,
  speech and transcription models, then chat models a request loaded, then
  those loaded by hand. A manual `loadModel` of any kind never unloads another
  model.

  Each load is sized by `assessModelFit`. `list()` rows of loaded models carry
  the estimate as `memoryBytes`, and `memoryUsage()` answers their total. `0`,
  a mobile device, and a host that never sets a cap keep one chat model a
  request loaded, as before (QVAC-25735). See
  [Keeping several models in memory](https://github.com/tetherto/qvac-harness/blob/v0.8.6/README.md#keeping-several-models-in-memory)
  and the
  [decision record](https://github.com/tetherto/qvac-harness/blob/v0.8.6/docs/decisions/2026-10-07-loaded-models-share-a-memory-budget.md).

  ```js
  await harness.setModelMemoryCap(85)

  const { usedBytes } = await harness.memoryUsage()
  const loaded = (await harness.list({ cachedOnly: true })).filter((m) => m.isLoaded)
  // each loaded row carries memoryBytes, the estimate its load was sized by
  ```

  (#358)

- `setDownloadsAllowed({ allowed })`, in process and over hrpc, lets a host hold
  model downloads, for example while a phone is on cellular, so a request
  cannot pull several GB without asking. Downloads are allowed by default, and
  `download()` itself is never held: it is how the host fetches a held model
  once the user approves.

  While downloads are not allowed, a load whose model is not on the device
  emits a `model` event with `status: 'held'`, the model's download name and
  its `addon`, then waits. It goes ahead once a `download()` puts the model on
  the device or downloads are allowed again. Aborting the caller's signal ends
  it with `AbortedError`, and a wait that ends without loading reports `error`
  with `message: 'aborted'`. This covers the image, music and translation
  runtimes and every pooled load (chat, embedding, speech, transcription).

  Over hrpc, every model event frame now carries an `addon` field, which is
  `null` unless the event is `held` or the `error` that ends a held wait. See
  [Holding model downloads](https://github.com/tetherto/qvac-harness/blob/v0.8.6/README.md#holding-model-downloads)
  and the
  [decision record](https://github.com/tetherto/qvac-harness/blob/v0.8.6/docs/decisions/2026-10-07-a-load-waits-for-a-download-the-host-holds.md).

  ```js
  await harness.setDownloadsAllowed({ allowed: false })

  harness.on('model', (state) => {
    if (state.status === 'held') askToDownload(state.model, state.addon)
  })

  // later, once the user agrees
  await harness.setDownloadsAllowed({ allowed: true })
  ```

  (#340)

- Ternary Bonsai 2 27B joins the curated catalog in two builds,
  `Ternary-Bonsai-2-27B-PQ2_0` (7.2 GB) and `Ternary-Bonsai-2-27B-PTQ1_0`
  (5.9 GB), each with its vision projection. Both sit in the `high` tier, by
  their memory footprint rather than their parameter count.

  It is a Qwen3.8-27B fine-tune whose name the SDK's dialect router does not
  recognise, so it parses tool calls as `qwen35`; a catalog entry can now name
  its tool dialect.

  ```js
  import { BONSAI_2_27B_PTQ1 } from '@qvac/harness/model-catalog'

  await harness.loadModel({ model: BONSAI_2_27B_PTQ1, agent: { ctxSize: 8192 } })
  ```

  (#303)

### Changed

- `@qvac/sdk` and `@qvac/inference` 0.21.0, with `@qvac/llm-llamacpp` 0.55.0.
  A host that packages the addons exempts `@qvac/fabric-<os>-<cpu>` from any
  install age gate: `@qvac/fabric` now ships its prebuilds as those
  per-platform packages. `@qvac/model-fit` leaves the native graph. The fit
  check passes the model's source to the SDK's new `loadModel`-shaped
  `assessModelFit` input. (#302)
- Transcribing long audio no longer needs memory in proportion to its length.
  It streams the audio to the model in 300 s segments instead of decoding the
  whole clip first: a 3.8 h clip peaked at about 0.9 GB above baseline, down
  from 1.8 GB. Clips under 60 s are transcribed as before. (#291)

### Fixed

- A run that preloads a skill (`@skill`, or a skill named in prose) no longer
  prefills the whole prompt on every round of a tool loop. It caches its prompt
  under a child of the chat's key for the length of the run, and the child key
  is deleted when the run ends. (#305)

## [0.8.5] - 2026-10-06

### Added

- The model can now read, edit and create PowerPoint, Word and Excel files
  without Python, on Bare and Node: skill-gated `pptx`, `docx` and `xlsx`
  tools on the office engine. These are the tools the presentations, word and
  excel skills in `@qvac/skills` 0.1.12 call.

  A call takes an `attachmentId` (or `create` options), `ops` that name engine
  methods with named arguments, and an `output` file name; with an
  `attachmentId` alone it returns the file's contents. The first failing op
  saves nothing and returns the engine's error.

  An edit is never saved under the attached file's own name. Saving the same
  file again in one turn answers with the one already attached, and a changed
  file under that name is refused. The one-line answer comes back as `reply`.
  See the
  [office engine](https://github.com/tetherto/qvac-harness/blob/v0.8.5/lib/office/engine/README.md)
  for the methods an op can name.

  ```js
  // the arguments a model passes to the pptx tool
  {
    create: { title: 'Q3 review' },
    ops: [{ op: 'addSlide', title: 'Revenue', body: 'Up 12% on Q2' }],
    output: 'q3-review.pptx'
  }
  ```

  (#286)

### Changed

- **Breaking:** `@qvac/skills` is now 0.1.12, whose office and pdf skills run on
  the `pptx`, `docx`, `xlsx` and `pdf` tools instead of Python. A host that
  passes its own `skillsDir` needs 0.1.12 as well: older office skills import
  Python libraries this release no longer ships. A host on the bundled skills
  has nothing to do.

  ```sh
  # a host whose own skillsDir comes from @qvac/skills
  # before
  npm install @qvac/skills@0.1.11
  # after
  npm install @qvac/skills@0.1.12
  ```

  (#286)

- `extractOfficeText` and `extractDocxText` no longer start Pyodide: they read
  .docx, .xlsx and .pptx in process on the engine, and read at most 1M cells
  across a workbook. Extracted workbook booleans read `true`/`false` instead of
  `True`/`False`. `closeOfficeWorker` and `closeDocxWorker` remain as no-ops.
  (#286)
- `exec` refuses Python that imports `pptx`, `docx` or `openpyxl`, or declares
  their packages, before it runs. The refusal names the tool (or the skill
  that grants it) to use instead, so the model moves to the office tools
  rather than trying to install the package. (#287)
- **Breaking:** Python run through `exec` asks for approval like any other
  write, including a run that only builds a new PDF. Those runs used to
  skip `approve`; now the user is asked. The `pdf` tool, which builds PDFs now,
  counts as a read and does not ask.

  ```js
  // before: exec running Python that only built a new PDF skipped approve
  // after: it reaches approve as a write, like any other Python run
  const context = {
    model,
    agent,
    messages,
    approve: async ({ name, effect }) => (effect === 'write' ? askUser(name) : true)
  }
  ```

  (#289)

### Removed

- **Breaking:** the vendored Python wheels for python-pptx, python-docx,
  openpyxl, fpdf2 and pypdf, and their dependencies. Only micropip is still
  seeded; any other package installs from PyPI, which sandbox mode refuses.
  Use the office and `pdf` tools.

  ```js
  // before: exec built a PDF offline with the vendored fpdf2
  { language: 'python', command: 'from fpdf import FPDF\n...', outputs: ['report.pdf'] }
  // after: the pdf tool builds it
  { action: 'create', markdown: '# Report\n...', output: 'report.pdf' }
  ```

  (#286, #289)

- The `exec` guidance written for python-pptx, python-docx and fpdf2 code:
  their error hints and source checks, and the shrink-to-fit pass on saved
  decks. (#288, #289)

## [0.8.0] - 2026-10-05

### Added

- The model can read, create and change PDFs without Python: a skill-gated
  `pdf` tool on `bare-pdfium` 1.6.0. The pdf skill in the next `@qvac/skills`
  release uses it instead of Python. On Node it reports that the device cannot
  open PDFs.

  With an `attachmentId` and no `action` it reads a PDF: the page count, each
  page's text and the form fields. With an `action` it saves a new file named
  `output` and attaches it: `create` from Markdown (chat images placed with
  `![caption](attachmentId)`), `merge`, `split`, `rotate`, `watermark`, `fill`,
  `encrypt`, `decrypt` and `text`.

  Errors name what exists, a locked PDF takes its password on any action, and
  the one-line answer comes back as `reply`.

  ```js
  // the arguments a model passes to the pdf tool
  { attachmentId, action: 'rotate', degrees: 90, pages: [2], output: 'scan-rotated.pdf' }
  ```

  (#256)

- An office engine in `lib/office/engine/` reads, edits and creates `.pptx`,
  `.docx` and `.xlsx` files in TypeScript on Bare and Node, so office editing
  no longer needs Python and can run on mobile. It is internal in this release:
  the tools that drive it come in 0.8.5.

  It keeps untouched parts byte for byte, fails with a `DocsError` whose code
  names the problem, and moves Excel references when rows and columns change.
  It adds `@xmldom/xmldom`, makes `bare-zlib` a direct dependency and maps
  `#zlib` to `bare-zlib` or `zlib`. See the
  [engine's README](https://github.com/tetherto/qvac-harness/blob/v0.8.0/lib/office/engine/README.md)
  and the
  [decision record](https://github.com/tetherto/qvac-harness/blob/v0.8.0/docs/decisions/2026-09-28-office-files-are-edited-by-the-harness-engine.md).
  (#150)

### Fixed

- Qwen3.5-family models no longer stall several tool calls into a turn. A tool
  call that ran goes back into the chat history in the Qwen3.5 template's own
  format (`<tool_call>` wrapper, one line per tag, string values as written)
  instead of a compact `<function=…>` line.

  A model several calls into a turn copied the compact form, the tool grammar
  rejected it, and the run ended in "This didn't finish". Models with another
  tool format (e.g. MedPsy) still get a format that is not their own, until
  the SDK accepts structured tool calls in history. (QVAC-23092, #146)

- A skill's gated tools now appear when the model first asks the skill for a
  file it does not have. Loaded with such a `file` before its instructions were
  loaded, the skill returns those instructions with a line naming the files it
  has, so it counts as loaded. Before, a one-file skill answered that the model
  already had its instructions, and its tools stayed hidden. (#257)
- Small models no longer keep calling tools on their own output until the round
  cap. After a tool attaches a file, the loop tells the model the file is shown
  and to answer, allows one more tool round, then writes the answer in a
  tool-less round. (#258)
- `exec`: text like `$1,299` in a shell command runs on the first try. A `$`
  before a digit, a space or punctuation is escaped instead of rejected. Real
  shell expansion is still refused, now with a hint to single-quote the text.
  (#208)

## [0.7.3] - 2026-10-01

### Added

- A tool can now end the turn with its own answer. A tool result may carry
  `answer: true` beside a non-empty `content`, and that content becomes the
  reply without another round through the model. The `tool-result` event still
  fires.

  `weather_lookup` uses it for an ambiguous or unknown place: the question that
  lists the namesakes, or the not-found line, is the reply.

  ```js
  const harness = new Harness({
    tools: [
      {
        name: 'store_hours',
        description: 'Opening hours of the store',
        parameters: { type: 'object', properties: {} },
        toolset: null,
        effect: () => 'read',
        execute: async () => ({ content: 'Open 9 to 5, Monday to Saturday.', answer: true })
      }
    ]
  })
  ```

  (#153)

### Fixed

- `weather_lookup` reports the place that was asked about: a bare "Nassau" now
  reports Nassau, Bahamas. It used to ask wttr.in by name, whose own geocoder
  put it in Westbury, New York.

  It now finds the place before it asks for the weather. It looks the city up
  on Open-Meteo's geocoder, `geocoding-api.open-meteo.com`, a new outbound
  host, and asks wttr.in for the forecast at the coordinates of the place it
  picked, which leads the report. The resource label names both hosts.

  A name that places of a similar size share, such as Springfield, gets a
  question listing up to four of them instead of a forecast: any namesake with
  a tenth of the largest one's population counts. A country or state in the
  request picks among them. When the geocoder is blocked, slow or failing, or
  knows no such place, the lookup asks wttr.in by name, as before. See the
  [decision record](https://github.com/tetherto/qvac-harness/blob/v0.7.3/docs/decisions/2026-09-16-a-lookup-reports-the-place-it-resolved.md).
  (#153)

## [0.7.2] - 2026-10-01

### Added

- A plain-text file `web_fetch` fetched (.txt, .csv, .json…) is now attached
  to the chat besides its text being returned, so the user can open or save
  it and `exec` can stage it to read past the returned text. The result
  carries its `attachmentId`, `fileName` and `byteLength`.

  A body cut at the fetch cap is not attached, and a host that cannot store
  files gets the text alone, as with page images.

  ```js
  for await (const event of harness.completion(context)) {
    if (event.type === 'tool-result' && event.name === 'web_fetch') {
      const { attachmentId, fileName, byteLength } = event.result
      // attachmentId is undefined when nothing was attached
    }
  }
  ```

  (#147, #148)

### Changed

- Speech sounds cleaner on desktops. Devices on the `mid` profile and up now
  speak with Supertonic 3 FP16 (`Supertonic3-FP16`, 207 MB) instead of Q8_0
  (127 MB), at 16 inference steps instead of 5, which removes the artifacts
  the 5-step output had.

  Synthesis takes about 2.7× as long, still around 7× faster than real time on
  an M-series Mac. Phones (`low`) and `tiny` devices keep Q4_0 at 5 steps.

  A host that prefetches `infraModelsFor` downloads the FP16 model once;
  `Supertonic3-Q8_0` stays in the catalog, and now also runs at 16 steps when a
  host asks for it by name.

  ```js
  import { defaultTtsModelName } from '@qvac/harness/model-defaults'

  defaultTtsModelName('mid') // 'Supertonic3-FP16', was 'Supertonic3-Q8_0'
  ```

  (#149)

## [0.7.1] - 2026-09-30

### Added

- A host can show a model as loading without counting loads itself. `list()`
  rows carry `isLoading`: true from the moment a load of that model starts,
  whoever asked for it (a request, `warmModel` or `loadModel`), until it is
  ready or the load fails. It is read off the pool.

  A model loading again under other settings while a copy of it is resident
  reads `isLoaded` and `isLoading` both true. Chat models read it today. Image,
  music and translation models load for each generation, and speech,
  transcription and embedding pools key by source, so those rows read `false`
  for now. It is an optional field on the wire; a row from an older harness
  reads `false`. See
  [Load and unload a model](https://github.com/tetherto/qvac-harness/blob/v0.7.1/README.md#load-and-unload-a-model).

  ```js
  const loading = (await harness.list({ cachedOnly: true })).filter((row) => row.isLoading)
  ```

  (#143)

### Changed

- A host that re-reads `list()` on `catalogChanged` sees a model turn loading,
  then loaded, with no bookkeeping of its own. The `model` event carries
  `catalogChanged` at every edge a re-read would show: the `loading` that
  starts a load and the `ready` or `error` that ends it, beside `unloaded`.
  Progress ticks still do not.

  The served event stream never drops a frame that carries it, so two `ready`
  frames of one model under two keys both cross.

  ```js
  harness.on('model', async (state) => {
    if (state.catalogChanged) render(await harness.list({ cachedOnly: true }))
  })
  ```

  (#143)

- `ModelInfo` requires `isLoading`, and `listModels`, `customModelRows` and
  `mergeCustomRows` return `CatalogRow`, the row before the pools are asked. A
  typed fake `list()` adds the field.

  ```js
  // before
  list: async () => [{ ...row, isLoaded: false }]

  // after
  list: async () => [{ ...row, isLoaded: false, isLoading: false }]
  ```

  (#143)

- A custom model's row reads `isLoaded` only once its load has landed; it used
  to read `true` from the first attempt. (#143)

### Fixed

- A host can tell a failed load from one still running. A load that ends
  without the model in memory emits `model` with `error` and the reason in
  `message`: it failed, or a suspend or close cancelled it. It used to end in
  silence. The `error` also refreshes the cached `isCached`, since a load may
  have downloaded the weights before it failed. (#143)

## [0.7.0] - 2026-09-29

### Added

- A host can tell what each model is for without keeping its own table.
  `list()` rows carry `taskType`: `llm`, `embeddings`, `speech-to-text`,
  `text-to-speech`, `image-generation`, `audio-generation`, `translation`,
  `text-recognition` or `other`.

  It is decided from the addon in one place, `lib/models/model-task.ts`, on
  each side of the wire rather than sent over it. `ModelTaskType` is exported,
  and grows the four new values a preview never returns.

  ```js
  const rows = await harness.list({ cachedOnly: true })
  const transcribers = rows.filter((row) => row.taskType === 'speech-to-text')
  ```

  (#140)

- `modelsForAgent(agent, host)` answers which models an agent runs on a device,
  each with its `use`: the chat model, clamped by `runnableModelName`, then the
  image and music models its skills need. A host deciding what to download, or
  which agents a model delete affects, asks this instead of working it out.

  `runnableModelName(requested, host)` and `isMobilePlatform(platform)` move
  here from `@qvac/core`: on a phone, a pick above the device's profile runs as
  its recommended model. Whether the host is a phone is the required `mobile`
  on `HostCapability`, which `capability()` now reports, so its answer passes
  straight in; a host built by hand has to say. `runnableModelName` and
  `isMobilePlatform` are on the browser-safe `@qvac/harness/model-catalog`
  entry too.

  ```js
  import { modelsForAgent, QWEN_35_9B } from '@qvac/harness'

  const agent = {
    modelName: QWEN_35_9B,
    installedSkills: ['image-generation'],
    skillsScope: 'all'
  }
  const models = modelsForAgent(agent, await harness.capability())
  // [{ name, addon: 'llm', use: 'chat' }, { name, addon, use: 'image' }]
  ```

  ```js
  import { runnableModelName, QWEN_35_4B, QWEN_35_9B } from '@qvac/harness/model-catalog'

  const host = { capabilityProfile: 'mid', recommendedModelName: QWEN_35_4B, mobile: true }
  runnableModelName(QWEN_35_9B, host) // QWEN_35_4B
  ```

  (#141)

- `capability()` answers `mobile`, whether the harness runs on a phone, read
  off the platform it probes. It rides `capability-response` as an optional
  field; a response from an older harness reads as `false`.

  ```js
  const { mobile } = await harness.capability()
  ```

  (#141)

- A host no longer needs to know what `modelChoice` means in an agent's
  `generate_music` tool settings. `musicModelChoiceFrom(settings)` reads the
  music model pick out of them, and `isMusicModelChoice` is exported beside it.

  ```js
  import { musicModelChoiceFrom } from '@qvac/harness/music-catalog'

  musicModelChoiceFrom({ modelChoice: 'turbo-hq' }) // 'turbo-hq'
  musicModelChoiceFrom({}) // undefined
  ```

  (#141)

### Changed

- **Breaking:** the package no longer publishes a prebuilt sidecar.
  `dist/harness.bundle`, `dist/harness.cjs`, `dist/prebuilds-manifest.json` and
  the `./dist/harness.cjs` export are gone. A host stows
  `worker/harness-sidecar.mjs` itself, as desktop and mobile already do, or
  spawns `worker/stow-entry.mjs` straight from its install. See
  [The published package](https://github.com/tetherto/qvac-harness/blob/v0.7.0/README.md#the-published-package)
  and [Spawning](https://github.com/tetherto/qvac-harness/blob/v0.7.0/README.md#spawning).

  ```js
  // before
  const harness = require('@qvac/harness/dist/harness.cjs')
  const { ipc, sidecar, exit } = await harness.start(args)

  // after
  import { spawnHarness } from '@qvac/harness'

  const harness = spawnHarness({
    entry: require.resolve('@qvac/harness/worker/stow-entry.mjs'),
    sdkStorage
  })
  ```

  (#127)

- **Breaking:** a stowed harness runs python in a worker rather than
  in-process. A host that stows the harness:

  - stops deferring `pyodide`
  - keeps `QVAC_PYODIDE_CACHE_DIR` writable
  - no longer stages a separate worker bundle
  - ships what stow offloads beside the bundle, which now includes pyodide's
    wasm, stdlib and lock file and the vendored wheels

  A target that embeds assets instead of offloading them cannot run python,
  since `fs` cannot read inside a bundle. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.7.0/docs/decisions/2026-09-25-the-python-worker-runs-on-bare-worker.md).
  (#127)

- A bundle of the package root carries neither pyodide nor the vendored
  wheels. Only an entry that runs python pulls them in: the exec tool, or
  `@qvac/harness/docx` and `/office`. (#127)
- `SandboxHook` no longer checks `packages`. The exec tool refuses an install
  the vendored wheels do not hold in full in sandbox mode, whether declared in
  `packages` or on a pip line, with the same message as before. (#127)
- The vendored wheels are the `#pyodide-wheels` directory asset on Bare;
  `QVAC_PYTHON_WHEELS_DIR` still overrides it. (#127)
- The python worker and the in-process deadline are spawned through
  `worker_threads`, which the package maps to `bare-worker`.
  `#pyodide-worker-spawn` is gone. (#127)
- **Breaking:** Bare refuses to load the package on runtimes older than 1.34.0:
  `engines.bare` is `>=1.34.0`. `bare-runtime` is pinned to 1.34.0 and
  `bare-sidecar` to 0.5.7 (Bare 1.34.0) across the tree, `bare-supervisor`'s
  copy included, with `bare-thread` at least 1.2.7 and `bare-module` 7.1.0 for
  `bare-worker`'s copy. A host upgrades its Bare to 1.34.0 or later. (#127)
- `bare-module` is no longer a dependency or an override, and
  `bare-module-traverse` is overridden to `~2.5.8`: earlier versions drop the
  `asset` condition on `bare-sidecar`'s binary, and a stowed harness then fails
  to boot on Bare 1.33 and later. (#127)
- `skillModelsForAgent` rows carry `use`, `image` or `music`, so a caller can
  tell which skill a model is for without looking the name up in the catalogs.
  (#141)
- `CapabilityInfo` has a required `mobile`. A `HarnessContract` whose
  `capability()` builds its own answer, a test stub included, returns it too.

  ```js
  // before
  capability: async () => ({ capabilityProfile: 'mid', recommendedModelName: QWEN_35_4B })

  // after
  capability: async () => ({
    capabilityProfile: 'mid',
    recommendedModelName: QWEN_35_4B,
    mobile: false
  })
  ```

  (#141)

### Removed

- **Breaking:** `bareRuntime` is no longer exported from `./lib/tools/exec.ts`,
  so the package root no longer loads the exec tool to reach it. It is at
  `./lib/tools/exec/bare-runtime.ts`.

  ```js
  // before
  import { bareRuntime } from '@qvac/harness/lib/tools/exec.ts'

  // after
  import { bareRuntime } from '@qvac/harness/lib/tools/exec/bare-runtime.ts'
  ```

  (#127)

- **Breaking:** `QVAC_PYODIDE_TEST_LOADER` is gone. A test points
  `QVAC_PYODIDE_WORKER_ENTRY` at an entry that serves its fake interpreter.

  ```sh
  # before
  QVAC_PYODIDE_TEST_LOADER=/path/to/fake-loader.js
  # after
  QVAC_PYODIDE_WORKER_ENTRY=/path/to/fake-worker-entry.js
  ```

  (#127)

### Fixed

- Python runs start on Bare 1.34, including in a stowed harness. Threads there
  cannot read a module off disk, so the worker is spawned through
  `worker_threads`, which the package maps to `bare-worker` on Bare. Pyodide is
  handed its asm module as `createPyodideModule`, and the files pyodide reads
  are named as assets, so a bundler carries them beside the bundle. (#127)

## [0.6.0] - 2026-09-28

### Added

- A host can load a model before anyone asks for it, and unload it on demand.
  `loadModel({ model, agent })` loads a downloaded chat, embedding, speech or
  transcription model under the key a request for it would load under, so the
  first request finds it loaded. Pass the agent a chat model will run for: its
  context size and KV cache types are part of that key.

  `unloadModel({ model })` unloads every copy of a model once the requests
  holding it finish, and says whether it could. Image and music models load for
  each generation and are refused.

  A load or an unload counts as a call in flight for `setModelIdleTimeout`, and
  one that lands during an idle unload waits for it. Both are on the wire as
  `load-model` and `unload-model`. See
  [Load and unload a model](https://github.com/tetherto/qvac-harness/blob/v0.6.0/README.md#load-and-unload-a-model).

  ```js
  import { QWEN_35_4B } from '@qvac/harness'

  const { loaded } = await harness.loadModel({ model: QWEN_35_4B, agent: { ctxSize: 8192 } })
  const { unloaded } = await harness.unloadModel({ model: QWEN_35_4B })
  ```

  (#133)

- Several chat models can stay loaded at once. A chat model loaded with
  `loadModel` is pinned: it does not count against `completionModelCap`, and a
  request for another model leaves it in place.

  A manual load never unloads another model to fit. It returns
  `{ loaded: false, reason: 'memory' }` when the SDK's `assessModelFit` says it
  would not fit beside what is loaded, so the host unloads one first. A request
  always gets its model: when it would not fit, pinned models no reply is using
  give way oldest first. A request or a manual load for a model under other
  settings replaces its idle copy. Image and music generation and an idle
  unload still clear every idle chat model, pinned or not. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.6.0/docs/decisions/2026-09-25-a-model-loaded-ahead-of-use-lands-where-its-request-looks.md).

  ```js
  import { QWEN_35_9B } from '@qvac/harness'

  const { loaded, reason } = await harness.loadModel({ model: QWEN_35_9B })
  if (reason === 'memory') showNotice('Unload a model first')
  ```

  (#134)

### Changed

- `list()` reports a fresh `isLoaded` for embedding, speech and transcription
  models, not only chat models. A model loading or unloading in any pool now
  emits `model` with `catalogChanged`. (#133)
- A speech, transcription or embedding model named once by its catalog name and
  once by its src is one copy in memory. Those requests key their pool entry by
  the model's registry src however the caller names it. (#133)

### Fixed

- A chat model loads when the host passes no `llmDevice`. 0.5.0 sent `device`,
  `gpu_layers`, `main-gpu` and `openclCacheDir` to the SDK as `undefined`,
  which the SDK spreads over its defaults. With no device the load failed with
  "must specify a device: 'gpu' or 'cpu'", and with a device but no
  `llmGpuLayers` the default of 99 GPU layers was lost. Unset fields are left
  out again. (#137)

## [0.5.0] - 2026-09-25

### Added

- `setModelIdleTimeout(ms)` frees memory on a device that has sat idle that
  long. With no `completion`, `invoke`, `embed`, `transcribe`, `speak`,
  `speakStream` or `warmModel` call in flight, every idle resident model is
  unloaded, including the image, music and translation runtimes, and the next
  call loads what it needs again.

  The clock is device-wide: any call resets it, whichever model it uses. `0`,
  the default, is Never and arms no timer. A turn waiting on a tool or an
  approval between rounds counts as busy, so it keeps its model. The call is on
  an in-process `Harness`, on the `RemoteHarness` client, and on the wire as
  `set-model-idle-timeout`. See
  [Freeing memory when idle](https://github.com/tetherto/qvac-harness/blob/v0.5.0/README.md#freeing-memory-when-idle)
  and
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.5.0/docs/decisions/2026-09-25-idle-unload-is-opt-in-and-device-wide.md).

  ```js
  await harness.setModelIdleTimeout(30 * 60_000) // 0 turns it off
  ```

  (#131)

- `setCustomModels` entries take an optional `label`, the name the user gave
  the model, and `list()` rows carry it back as `label`.

  The label also picks the tool-call format: the model family (Qwen, Gemma,
  LFM and so on) is matched against the label as well as the file name, with
  spaces read as hyphens, so a custom model registered under an opaque id
  still gets its family's format. (#124)

- `setCustomModels` entries take an optional `contextLength`, the model's
  trained window, which caps the context it loads with by default (see
  Changed). Pass the preview's `contextLength` straight through. See
  [Register the set](https://github.com/tetherto/qvac-harness/blob/v0.5.0/README.md#register-the-set).

  ```js
  await harness.setCustomModels([
    {
      name: 'custom-7f3a',
      label: 'Gemma 4 E4B',
      src: preview.src,
      contextLength: preview.contextLength
    }
  ])

  const [row] = (await harness.list({ type: 'llm' })).filter(
    (model) => model.name === 'custom-7f3a'
  )
  row.label // 'Gemma 4 E4B'
  ```

  (#124)

### Changed

- A custom model loads with a context of the smaller of 51,200 tokens and its
  trained `contextLength`, where it always took 51,200 before. A model trained
  on 40,960 tokens now loads with 40,960. A context size the caller asks for
  still wins. (#124)

### Fixed

- `previewModelSource` takes a direct link to one shard of a split `.gguf` as
  the whole set. `src` is the first part, which holds the metadata, and
  `sizeBytes` adds up every part, so `isCached` can match the finished
  download. Every part is checked with a `HEAD` request, and a missing part
  refuses with `not-found` or `unreachable`, naming the part. See
  [Preview a source before adding it](https://github.com/tetherto/qvac-harness/blob/v0.5.0/README.md#preview-a-source-before-adding-it).
  (#124)

- `isCached` reports a sharded custom download once every shard is on disk in
  the folder the SDK keeps them in; it always read false before. `deleteModel`
  removes all of its shards, where it left them behind. See
  [List them](https://github.com/tetherto/qvac-harness/blob/v0.5.0/README.md#list-them)
  and
  [Delete a download](https://github.com/tetherto/qvac-harness/blob/v0.5.0/README.md#delete-a-download).
  (#124)

## [0.4.0] - 2026-09-24

### Added

- `previewModelSource({ src, mmprojSrc })` checks a Hugging Face link, a direct
  `.gguf` link or a local path before a host adds it as a custom model. It
  reads the Hugging Face metadata and the file's GGUF header, never the whole
  model.

  The answer is one of three:

  - a file to register: `ok: true` with `src`, `sizeBytes`, `contextLength`,
    `architecture`, `sizeLabel`, `taskType`, `license`, `fit` and
    `fitReasons`;
  - a choice: `ok: true` with a list of `files` and no `src`, for a repo that
    holds several weights;
  - a refusal: `ok: false` with a `refusal` code and a `reason` to show.

  It is served on the `RemoteHarness` client and on an in-process `Harness`,
  and its types (`ModelSourcePreview`, `ModelSourceFile`,
  `ModelSourceRefusal`, `ModelFitVerdict`, `PreviewModelSourceContext`) are
  exported from the package root. See
  [Preview a source before adding it](https://github.com/tetherto/qvac-harness/blob/v0.4.0/README.md#preview-a-source-before-adding-it)
  and
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.4.0/docs/decisions/2026-09-22-a-model-source-is-previewed-before-it-is-added.md).

  ```js
  const preview = await harness.previewModelSource({ src: link })

  if (!preview.ok) return showError(preview.reason)
  if (!preview.src) return pickOneOf(preview.files) // preview the pick next
  if (preview.taskType !== 'llm') {
    return showError('Only an llm runs as a custom model')
  }
  ```

  (#121)

- `setCustomModels` entries take `taskType` and `expectedSize`, and `list()`
  returns the registered custom models after the catalog rows, under the same
  `type` and `cachedOnly` filters.

  A custom row has `registrySource: 'custom'` and `isLoaded`. Its `isCached`
  is false until every file is on disk and, when `expectedSize` is set, their
  sizes add up to it, so a partial download is not cached. See
  [Register the set](https://github.com/tetherto/qvac-harness/blob/v0.4.0/README.md#register-the-set)
  and
  [List them](https://github.com/tetherto/qvac-harness/blob/v0.4.0/README.md#list-them).

  ```js
  await harness.setCustomModels([
    {
      name: 'nanbeige-3b',
      src: preview.src,
      projectionSrc: preview.mmprojSrc,
      taskType: preview.taskType,
      expectedSize: preview.sizeBytes
    }
  ])

  const models = await harness.list({ type: 'llm' })
  const custom = models.filter((model) => model.registrySource === 'custom')
  ```

  (#121)

- A `modelsDir` Harness option says where downloads live, so `list()` and
  `deleteModel` can find a custom model's files. The spawned sidecar sets it
  from its SDK storage; an in-process `Harness` has to pass it. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.4.0/docs/decisions/2026-09-24-a-custom-download-is-found-at-the-sdk-cache-path.md).

  ```js
  const harness = new Harness({ modelsDir })
  ```

  (#121)

### Changed

- `deleteModel(name)` frees the disk a custom model's download took: it
  removes the weight and projection the model downloaded, where it used to
  remove nothing.

  It never touches a local path the user pointed at, since those are the
  user's files. The model stays registered and lists as not cached, ready to
  download again. See
  [Delete a download](https://github.com/tetherto/qvac-harness/blob/v0.4.0/README.md#delete-a-download).

  ```js
  const { removed, freedBytes } = await harness.deleteModel('nanbeige-3b')
  ```

  (#121)

- A custom model name resolves only where an `llm` is loaded, never for
  another task. A `setCustomModels` entry whose `taskType` is anything other
  than `llm` is not registered. An entry without `taskType` is an `llm`, as
  before, so a host that registers only text models changes nothing. (#121)

### Fixed

- A chat no longer fails with a context overflow after turns that load a
  skill up front. A turn that preloads a skill with `@skill`, or names an
  active skill in its prompt, used to cache the inlined SKILL.md body under
  the chat's KV key. Each such turn left about 7k tokens stranded in the
  cache, until a later turn overflowed the context window and failed. (#120)

## [0.3.3] - 2026-09-24

### Changed

- `@qvac/sdk` and `@qvac/inference` 0.20.0. A host that packages the addons
  has packaging work to do.

  Some addons now ship their prebuilds as per-platform packages
  (`@qvac/<addon>-<os>-<cpu>`, for `asr-ggml` 0.5, `audiogen-ggml` 0.4 and
  `tts-ggml` 0.9), which the addon names in its `#host-addon` import map, and
  `@qvac/model-fit` and `@qvac/fabric` join the native graph as deferred
  addons. The harness no longer pins `@qvac/asr-ggml` and lets the SDK resolve
  it.

  A host that packages the addons resolves prebuilds through that map, and
  exempts the new package names from any install age gate: bun skips a blocked
  optional dependency without a word, and the prebuild goes missing. See
  [The published package](https://github.com/tetherto/qvac-harness/blob/v0.3.3/README.md#the-published-package).

  ```toml
  # bunfig.toml, for each host the app ships to
  [install]
  minimumReleaseAgeExcludes = [
    "@qvac/model-fit",
    "@qvac/asr-ggml-darwin-arm64",
    "@qvac/audiogen-ggml-darwin-arm64",
    "@qvac/tts-ggml-darwin-arm64"
  ]
  ```

  (#85)

- A user message with several images reaches the SDK as one turn again. The
  per-image split added for QVAC-24156 is gone, since SDK 0.20 carries the
  upstream fix (llama.cpp #27348) and equal-size still images no longer merge
  as video frames and abort the encode.

  This release must not be paired with SDK 0.19, where that crash comes back.
  `<key>-vision-history-v1` cache directories left by the split are no longer
  read, and clearing all caches removes them. (#116)

- `@qvac/skills` 0.1.9. The diagrams skill carries every recipe inline, so a 2B
  model no longer loops on loading a reference file it cannot name. The excel
  skill routes a chat image to create rather than edit, the Google OAuth routes
  drop the loopback port, and the Asana skill's first setup step names the
  Asana MCP app to connect. (#115, #118)

### Fixed

- Retrying or regenerating in a chat that held a multi-image message could
  reuse a stale cached prefix and condition on the superseded answer. The split
  kept that chat's cache under a sibling key the host's reclaim never reached.
  (#116)

## [0.3.2] - 2026-09-23

### Changed

- A person approving a networked Python run now sees where it will connect,
  and any other host is asked about as the run reaches it.

  The approval label leads with the hosts the source names in a URL, as
  `python · network: www.youtube.com …`, or says
  `network: no host named in the code`. On an approved run those hosts, and
  their `www.` form, are reached without asking; a subdomain is not.

  Any other host, such as a CDN a library fans out to, a redirect or a URL
  built at runtime, pauses the run and is asked about through the completion's
  `askUser` before its name is looked up. A host allowed once stays allowed
  for that run, and silence past a minute counts as a no. A host that does not
  wire `askUser` refuses every unnamed host, and a skip-all run asks nothing.
  See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.2/docs/decisions/2026-09-22-python-reaches-the-network-through-the-guarded-fetch.md).

  ```js
  for await (const event of harness.completion({
    model,
    agent,
    messages,
    approve,
    // options are ['Allow', 'Deny']; an answer starting with "Allow" allows it
    askUser: ({ question, options }) => showQuestion(question, options)
  })) {
    render(event)
  }
  ```

  (#109)

### Fixed

- A timed-out Python run no longer spins at full CPU until the process is
  killed when Pyodide has no worker thread, as for a stowed bundle whose host
  does not set `QVAC_PYODIDE_WORKER_ENTRY`.

  It is now interrupted at the deadline, rejects with
  `Command timed out after <ms>ms`, and the interpreter keeps its state. A
  blocking call such as a long `time.sleep` still sees the interrupt only once
  it returns. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.2/docs/decisions/2026-08-11-pyodide-worker-thread.md).
  (#104)

- A timed-out Python run on the worker thread keeps its interpreter state. It
  could miss its SIGINT, so the worker was killed after the grace window along
  with the interpreter's state. The interrupt is now resent every 100 ms until
  the run settles. (#112)

- A Python run that fails no longer attaches a broken file. A run that failed
  partway through a save attached the half-written file, and each failing
  retry attached another copy under the same name. A non-zero exit now
  attaches nothing and reports every declared output in `missingOutputs`, so
  the retry writes it again. (#110)

### Security

- Python in `exec` reached the network whenever the runtime allowed it,
  including a call that auto-ran as a read with no approval prompt, so a
  document build that loads an image from a URL could reach the web without
  anyone seeing it.

  The network now opens only to a call a person approved or that skip-all let
  through, and sandbox mode stays offline. 0.3.1 is affected; upgrade from it.
  See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.2/docs/decisions/2026-09-22-python-reaches-the-network-through-the-guarded-fetch.md).
  (#108)

## [0.3.1] - 2026-09-23

### Added

- Python in `exec` reaches the network on Bare. `urllib`, `http.client` and
  what is built on them, yt-dlp included, work unchanged, and `requests`
  works through urllib3's emscripten backend.

  Every request goes through the guarded fetch the web tools use: each hop is
  checked before it is sent, credentials do not follow a redirect to another
  origin, and a response is capped at 100 MB. Where the global `fetch` is not
  the guarded one, as on Node, Python stays offline, and `sandboxMode` keeps
  it offline everywhere. A Python run may now declare `.mp4`, `.webm`, `.m4a`
  and `.mp3` outputs, each checked by its file signature. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.1/docs/decisions/2026-09-22-python-reaches-the-network-through-the-guarded-fetch.md).
  (#94)

  ```js
  // exec arguments a model can now send on Bare
  {
    language: 'python',
    command:
      "import urllib.request\n" +
      "urllib.request.urlretrieve('https://example.com/talk.mp3', 'talk.mp3')",
    outputs: ['talk.mp3']
  }
  ```

- A host can probe a fresh OAuth token before saving it.
  `SkillOAuthConfig.verify` is parsed from a skill manifest's
  `setup.routes[].oauth.verify` and carried over the wire;
  `SkillOAuthVerify` and `SkillOAuthVerifyRule` are exported. The harness
  only parses the probe; the host runs it.

  A probe is an https `url` on the same site as the route's `tokenUrl`, an
  optional `GET` or `POST` `method` and JSON `body`, and `reject` rules. A
  rule matches a listed `status`, or a 2xx JSON body whose `field` is not
  `notEqual` (a rule with both needs both), and its `error` names the
  rejection. A probe that breaks these rules is dropped and the route kept.
  (#105)

  ```js
  const skills = await harness.skills()
  const route = skills
    .find((skill) => skill.name === 'asana')
    ?.setup?.routes?.find((r) => r.kind === 'oauth')

  // { url: 'https://mcp.asana.com/v2/mcp', method: 'POST',
  //   body: '{"jsonrpc":"2.0",…}',
  //   reject: [{ status: [401, 403], error: 'asana_not_mcp_app' }] }
  const verify = route?.oauth?.verify
  ```

- A skill operation may name `response.decode` to turn a provider's JSON body
  into a compact shape before the model sees it. The first decoder is
  `gmail-message`: the ids and labels, the From, To, Subject, Date,
  Message-ID and References headers, the snippet, and the body as text,
  capped at 4000 characters. A `gmail-get` request builder goes with it.

  A manifest naming both `pick` and `decode`, or a builder or decoder this
  harness does not have, is rejected. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.1/docs/decisions/2026-09-01-skill-operation-manifests.md).
  (#69)

  ```js
  // an operation in a skill's operations.json (gmail, @qvac/skills 0.1.7)
  {
    tool: 'gmail_get',
    request: {
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}',
      query: { metadataHeaders: 'Subject,From,To,Date,Message-ID,References' },
      builder: 'gmail-get'
    },
    response: { decode: 'gmail-message' }
  }
  ```

### Changed

- A compiled skill operation whose HTTP method is `GET`, `HEAD` or `OPTIONS`
  now runs without an approval prompt. It is a read, like the same request
  through `http_request`, and takes no `intent` argument. MCP operations and
  every other method are still writes that ask. (#69)
- `@qvac/skills` 0.1.7, now pinned exactly. Gmail reads a message with
  `gmail_get` instead of telling the model to decode base64, which needs this
  release's decoder, and Asana rejects a non-MCP app at connect time through
  a `verify` probe. (#105)

### Fixed

- A malformed `<tool_call>` left its JSON arguments in the reply. The whole
  span is now stripped, and an unclosed one is stripped to the end of the
  text. (#100)
- A misspelt, placeholder or repeated `skill` load returned an error the model
  retried until the turn ran out. A placeholder or the skill's own name now
  reads the body, a near miss of one of its files loads that file, and a
  repeat is acknowledged without re-reading it. (#101)
- When the model reached for `pip` or a video tool on the shell path, it was
  only told what the path is not, and retried the same call. Each refusal now
  names the call that works, such as `packages: ["requests"]` with the pin a
  vendored package installs offline under.

  A missing import names the package that provides it, and `python -c`, a
  heredoc or bare Python source runs as Python instead of being sent back for
  a `language` argument. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.1/docs/decisions/2026-09-21-exec-names-the-call-that-works.md).
  (#71)

## [0.3.0] - 2026-09-23

### Added

- A `translate` capability for `invoke`: text translation without loading an
  LLM. The language pair picks the route before anything loads:

  - English and one of nine European languages go through the
    TranslatePsy-EuroNano packs.
  - The other 43 languages Bergamot serves go through their per-pair models,
    pivoting through English when neither side is English.
  - 16 languages Bergamot has no model for go through TranslatePsy-AfriSLM,
    named by ISO 639-1 or FLORES-200 code.

  An omitted `from` is detected from the text, except for the AfriSLM
  languages, which need it named. The `tool-result` carries the text, the pair
  and the `engine` that answered (`nmt`, `slm`, or `none` when the text is
  already in the target language). A pair no route serves, or a source that
  cannot be detected, comes back as `result.error`. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.0/docs/decisions/2026-09-21-translation-pivots-through-english.md).
  (#76)

  ```js
  for await (const event of harness.invoke({
    capability: 'translate',
    args: { text: 'The weather is nice today.', to: 'de' }
  })) {
    if (event.type === 'tool-result') {
      if (event.result.error) showError(event.result.error)
      else show(event.result.text)
    }
    if (event.type === 'error') showError(event.message)
  }
  // result: { text, from: 'en', to: 'de', engine: 'nmt', pivoted: false }
  ```

- `translationPlanFor`, `NMT_TO_ENGLISH`, `NMT_FROM_ENGLISH`,
  `EURONANO_LANGUAGES`, `SLM_LANGUAGE_CODES` and `SLM_LANGUAGE_NAMES` exports,
  so a host can build a language picker or preview a route without a registry
  lookup. (#76)

  ```js
  import { translationPlanFor, SLM_LANGUAGE_NAMES } from '@qvac/harness'

  const plan = translationPlanFor('es', 'ja')
  // { route: 'nmt', from: 'es', to: 'ja',
  //   model: 'model.esen.intgemm', pivot: 'model.enja.intgemm' }
  if ('error' in plan) showError(plan.error)
  ```

- `enhance: 'never' | 'auto'` on `invoke`, for the `image` capability. With
  `'auto'`, the prompt is rewritten by a model already resident on the
  device, and never triggers a load: with nothing resident, or a rewrite that
  fails, the run goes direct. Omitting `enhance` behaves as `'never'`, which
  passes the arguments through untouched.

  `metrics` reports the `route` taken (`direct` or `enhanced`), the
  `routeModel` used and the tokens the rewrite spent. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.3.0/docs/decisions/2026-09-21-a-caller-states-constraints-not-mechanisms.md).
  (#77)

  ```js
  for await (const event of harness.invoke({
    capability: 'image',
    args: { prompt: 'funny meme' },
    enhance: 'auto',
    attach
  })) {
    if (event.type === 'metrics') log(event.route, event.routeModel)
  }
  ```

### Changed

- A host that assembles the native prebuilds beside the bundle now has to
  include `@qvac/translation-nmtcpp`. The bundle defers it like the other
  inference addons, so `prebuilds-manifest.json` names its prebuilds. It is
  already a dependency of `@qvac/sdk`, so it is in the host's
  `node_modules`. See
  [The published package](https://github.com/tetherto/qvac-harness/blob/v0.3.0/README.md#the-published-package).
  (#76)

## [0.2.12] - 2026-09-22

The first published release with the 0.2.11 changes (`invoke`,
`detectLanguage`, `SkillOAuthConfig`), plus the fix below.

### Fixed

- The pdf, presentations, word and excel skills work again under
  `sandboxMode`. Sandbox mode refused every `exec` call that installs
  packages, including installs that never leave the device.

  A request whose packages are all vendored, each pinned to the version the
  shipped wheels carry, now installs from those wheels. One unvendored
  package, an unpinned version, or a host that ships no wheels would fall
  back to PyPI, and is still refused. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.2.12/docs/decisions/2026-09-21-sandbox-mode-no-network.md#consequences).
  (#91)

## [0.2.11] - 2026-09-22

Tagged but never published to npm; these changes first shipped in 0.2.12.
Install 0.2.12 or later to get them.

### Added

- `invoke({ capability, args })` runs one capability on its own, with no
  model, no dispatch and no approval callback: the caller already decided.
  `image` is the first capability, and `CAPABILITIES` and `isCapability` list
  and check the names.

  It is a frame on the existing `completion` stream, so it takes the same
  `attach`, `progress` and abort signal, and emits the same `tool-call`,
  `tool-result`, `metrics`, `error` and `aborted` events. `metrics` reports
  `totalTokens: 0`. An optional `agent` supplies the image defaults (model,
  steps, size). A failure inside the tool, such as a missing `attach`, comes
  back as `result.error` on the `tool-result`; the `error` event is for a
  capability the device lacks or a tool that threw.

  It is on `Harness` and `RemoteHarness` alike, and optional on
  `HarnessContract`. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.2.11/docs/decisions/2026-09-21-a-run-that-loads-no-model.md).
  (#74)

  ```js
  for await (const event of harness.invoke({
    capability: 'image',
    args: { prompt: 'a lighthouse at dusk', width: 768, height: 512 },
    attach,
    progress,
    signal
  })) {
    if (event.type === 'tool-result') {
      // { attachmentId, fileName, byteLength, width, height } or { error }
      if (event.result.error) showError(event.result.error)
      else showImage(event.result.attachmentId)
    }
    if (event.type === 'error') showError(event.message)
  }
  ```

- `detectLanguage({ text, topK })`: language detection with no model to load.
  It is on `Harness`, served over hrpc as `detect-language`, and on
  `RemoteHarness`.

  Without `topK`, or with 1, it answers with the single best match and no
  probability. Above that it returns ranked candidates with their
  probabilities, best first, and may return fewer than asked. Text it cannot
  place answers `und`. (#75)

  ```js
  const [best] = await harness.detectLanguage({ text })
  // { code, language }

  const ranked = await harness.detectLanguage({ text, topK: 3 })
  // [{ code, language, probability }, ...]
  ```

- A host can run a skill's OAuth setup from its manifest instead of its own
  provider table. `SkillSetupRoute.oauth` carries a `SkillOAuthConfig` parsed
  from `setup.routes[].oauth` and sent over the wire, and `SkillOAuthConfig`
  is exported.

  `stateKey`, an https `authUrl` and `tokenUrl`, and `tokenAuth`
  (`pkce-only`, `secret-in-body` or `secret-in-basic`) are required; an
  `oauth` route without a valid config is dropped. `extraAuthParams` may not
  override the parameters the flow owns, such as `redirect_uri` or `state`.
  (#88)

  ```js
  const skills = await harness.skills()
  const route = skills
    .find((skill) => skill.name === 'spotify')
    ?.setup?.routes?.find((r) => r.kind === 'oauth')

  // { stateKey, authUrl, tokenUrl, scopes, tokenAuth,
  //   extraAuthParams?, registrationEndpoint?, port?, sharedIosSession? }
  const oauth = route?.oauth
  ```

### Changed

- `@qvac/skills` `^0.1.6`: the eight OAuth skills declare their setup routes'
  OAuth config, the Spotify skill always makes the play call after a search,
  and the weather skill looks the place up with `weather_lookup`. (#88)

### Fixed

- Asked to fetch a file, the model tried `http_request` and `exec` before
  `web_fetch`, and once the file was attached it had no id to read it with.
  `web_fetch` now offers file downloads (PDF, Office documents, images) in its
  description, and its result carries the `attachmentId`, `fileName` and
  `byteLength` it created, so the model can stage the file into `exec` and it
  survives a history fold. (#89)

## [0.2.10] - 2026-09-22

### Added

- `sandboxMode` agent option: an agent that cannot reach the network. Set it
  on the agent and every network tool is withheld before the model sees the
  catalog: the web search, HTTP request and MCP toolsets, including skill
  operations compiled over HTTP or MCP, not just web search.

  `exec` stays, but refuses package installs and well-known network commands
  such as `curl`, `git` and `npm`. That is a name-list guard, not an OS-level
  sandbox: another binary, or Python calling `pyfetch`, can still open a
  socket. The six toolset switches stay independent; this is the one knob
  that means "no network". See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.2.10/docs/decisions/2026-09-21-sandbox-mode-no-network.md).
  (#73)

  ```js
  for await (const event of harness.completion({
    model,
    messages,
    agent: { ...agent, sandboxMode: true }
  })) {
    render(event)
  }
  ```

- `@qvac/harness/office`: XLSX and PPTX text extraction for Knowledge, beside
  DOCX, through the same bundled Python worker. `extractOfficeText` picks the
  format from the file extension, with `mimeType` as the fallback.

  XLSX keeps sheet names, column positions, cached formula values (formula
  text where there is no cached value). PPTX keeps slide text, grouped shapes
  and tables in slide order; speaker notes, images and charts are left out.
  Legacy XLS and PPT are not supported. `@qvac/harness/docx` is unchanged and
  shares the worker. See
  [Office extraction](https://github.com/tetherto/qvac-harness/blob/v0.2.10/README.md#office-extraction)
  for the cache and wheel paths a host sets. (#83)

  ```js
  import { extractOfficeText, closeOfficeWorker } from '@qvac/harness/office'

  const text = await extractOfficeText(bytes, 'report.xlsx', { signal, mimeType })
  // at host shutdown, once extractions have settled
  await closeOfficeWorker()
  ```

### Fixed

- A small model no longer loops on the same failing tool call up to the round
  cap. A call that already failed this turn with the same arguments is
  answered from its first result without running again, until a later round
  succeeds. Three such answers end the turn's tool rounds; the tool set is
  never changed, so the prompt cache is kept.

  A failure that may pass on retry, such as a timeout, a 5xx, 408 or 429,
  still runs again, and the tools that can fail that way now say so in a
  `code` or `status` field on their result. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.2.10/docs/decisions/2026-09-21-a-failed-call-is-answered-from-its-own-result.md).
  (#78)

- A guessed `auth.tokenCredentialKey` on `http_request` or `mcp_call` now
  works instead of failing with an error claiming the skill was not loaded.
  It resolves to the one connected credential allowed for that URL. When
  none is connected, the error says so and tells the user to connect it in
  Skills. (#72)

## [0.2.9] - 2026-09-22

### Added

- A host can record exactly what each inference round sent. Set
  `captureInferenceCalls` on a completion's context, and each round emits an
  `inference-call` event with the payload it is about to send: model,
  messages, tools, generation params, cache key and prompt prefix.

  An `inference-sent` event follows once the round ends, with the tokens it
  spent, its `outcome` (`completed`, `overflowed` or `failed`) and, on the
  bundled patched SDK, the slice of `messages` the KV cache let through. An
  attempt the overflow ladder rejected is still recorded, with its
  `droppedTurns`. See
  [What actually gets sent](https://github.com/tetherto/qvac-harness/blob/v0.2.9/docs/kvcache-reference.md#what-actually-gets-sent).

  Off unless asked for, since every record carries a whole prompt. The flag
  and both events are new on the hrpc wire, so the host and the spawned
  harness both need 0.2.9. (#51)

  ```js
  const context = { model, agent, messages, captureInferenceCalls: true }
  for await (const event of harness.completion(context)) {
    if (event.type === 'inference-call') record(event.call)
    if (event.type === 'inference-sent') settle(event.round, event.outcome)
  }
  ```

- A host can tell a cut-off answer from a complete one. The `metrics` event
  carries the last round's `stopReason`, and leaves it out when the SDK
  reports none. A turn cut off by the context window ends cleanly with
  `stopReason: 'length'`. See
  [Compaction](https://github.com/tetherto/qvac-harness/blob/v0.2.9/docs/kvcache-reference.md#compaction).
  (#62)

  ```js
  if (event.type === 'metrics' && event.stopReason === 'length') markTruncated()
  ```

### Changed

- The published tarball no longer carries `docs/`, `CLAUDE.md`, `.claude/` or
  eval output. (#79)

## [0.2.8] - 2026-09-17

### Added

- `weather_lookup`, a tool that looks weather up on wttr.in by `location` and
  leads its report with the place the service actually resolved.

  When that place disagrees with the country or state the user named, it
  refuses instead of reporting the weather of wherever the geocoder landed: a
  nonexistent town no longer gets a forecast, and a bare "Rome" the service
  places in Togo says so.

  It is offered only once the weather skill is loaded, needs no approval, and
  the `http-request` toolset switch turns it off. The spawned sidecar registers
  it; an in-process host adds it to its tools. See
  [the decision record](https://github.com/tetherto/qvac-harness/blob/v0.2.8/docs/decisions/2026-09-16-a-lookup-reports-the-place-it-resolved.md).
  (#52)

  ```js
  import { Harness } from '@qvac/harness'
  import { createWeatherLookupTool } from '@qvac/harness/lib/tools/weather-lookup.ts'

  const harness = new Harness({ tools: [...tools, createWeatherLookupTool()] })
  ```

### Changed

- **Breaking:** `currentReleaseLine` from `@qvac/harness/schema/release-tags`,
  the schema build tooling, is now `currentReleaseVersion`, and returns the
  full `bare-semver` `Version` rather than a `major.minor` string. A host that
  imports it imports `currentReleaseVersion` instead and reads the line off
  the version. (#55)

  ```js
  // before
  import { currentReleaseLine } from '@qvac/harness/schema/release-tags'
  const line = currentReleaseLine(root) // '0.2'

  // after
  import { currentReleaseVersion } from '@qvac/harness/schema/release-tags'
  const version = currentReleaseVersion(root) // Version 0.2.8
  const line = `${version.major}.${version.minor}`
  ```

- A schema change is now checked against the build users are running.
  `previousReleaseTags` from the same module counts the newest shipped tag on
  the line being built as a baseline, not only older lines; only tags newer
  than the package version are left out.

  A host that regenerates its `spec/` against it re-derives hyperschema's
  version counters once, so expect one regeneration commit after upgrading.
  (#55, #58)

- `@qvac/skills` 0.1.4: the Apple Notes create-note operation no longer
  renames a note after creating it, which failed on iCloud accounts and left
  duplicate notes behind. (#48)

## [0.2.7] - 2026-09-16

### Added

- `@qvac/harness/docx`: `extractDocxText` gives Knowledge a DOCX file's text,
  pulled with the bundled Python runtime. Paragraphs and tables keep document
  order, one table row per line with cells joined by `' | '`.

  It takes up to 20 MiB and only the shipped wheels, never a network install.
  Set `QVAC_PYODIDE_CACHE_DIR` to a writable directory first, so the worker
  seeds its cache from those wheels and works offline. A bundled host also
  sets `QVAC_PYODIDE_WORKER_ENTRY` and `QVAC_PYTHON_WHEELS_DIR` to its staged
  worker and wheels. See
  [DOCX extraction](https://github.com/tetherto/qvac-harness/blob/v0.2.7/README.md#docx-extraction).
  (#46)

  ```js
  import { extractDocxText, closeDocxWorker } from '@qvac/harness/docx'

  const text = await extractDocxText(bytes, 'notes.docx', { signal })

  // at shutdown, once outstanding extractions have settled
  await closeDocxWorker()
  ```

### Fixed

- A Python run whose signal aborted while it waited for another run to finish
  is no longer started. (#46)

## [0.2.6] - 2026-09-15

### Added

- `completionModelCap`, default 1: how many completion models may be resident
  at once. It is a `HarnessOptions` field, and rides the `llm` config through
  `spawnHarness` and `harnessChild`. (#41)

  ```js
  const harness = spawnHarness({
    entry,
    sdkStorage,
    llm: { contextSize: 8192, completionModelCap: 2 }
  })
  ```

- A caller can declare which hrpc requests may be omitted. `writeClient` and
  `writeCapabilities` from `@qvac/harness/schema/generate` take an options
  argument whose `optionalRequests` names those request types: the generated
  client sends `{}` for them, and the generated capability types mark the input
  optional.

  Left out, only `@assistant/empty` is optional, as before. A set you pass
  replaces that default, so include it if you still want it. `writeClient`
  still takes an export name as a string. (#44)

  ```js
  import { writeClient, writeCapabilities } from '@qvac/harness/schema/generate'

  const optionalRequests = new Set(['@assistant/empty', '@assistant/mesh-scope'])
  writeClient(builder, 'spec/calls.js', {
    exportName: 'engineClient',
    optionalRequests
  })
  writeCapabilities(builder, 'spec/capabilities.d.ts', { optionalRequests })
  ```

### Changed

- Switching models no longer stacks a second one in memory beside a live run.
  A completion that needs a different model waits for that run to release its
  model, for up to five minutes, and then loads anyway rather than failing.

  A `warmModel` call waits two seconds at most, and skips the warm if no room
  was made. (#41)

## [0.2.5] - 2026-09-14

### Added

- A host that already has the GPU reading can hand it over: a `gpuStats`
  option on `spawnHarness`, `harnessChild` and `HarnessOptions`, and the
  harness skips its own probe. Left out, the harness probes for itself. It
  takes the `bare-gpu-info` shape: `memory.totalBytes` and `gpu.devices`, each
  with a `name` and `videoMemoryBytes`. (#36)

  ```js
  import { spawnHarness } from '@qvac/harness/lib/spawn.ts'

  const harness = spawnHarness({
    entry,
    sdkStorage,
    gpuStats: {
      memory: { totalBytes: os.totalmem() },
      gpu: {
        devices: [{ name: 'NVIDIA RTX 4070', videoMemoryBytes: 12884901888 }]
      }
    }
  })
  ```

### Fixed

- The harness stays up on a Linux snap. It exited about a second after `open`,
  and the supervisor respawned it in a loop: the boot-time capability probe
  created a second GPU-info instance beside the SDK's own.

  On Linux and Windows under Bare, GPUs are now enumerated in a short-lived
  child process, which gives up after 5 seconds and reports no GPU. (#36)

- On Windows, asking for an image after a presentation no longer leaves the
  chat stuck on "Loading … into memory". Pyodide's boot opened the process
  streams from the Python worker thread, which blocked the image-model loader's
  progress. Boot now never touches them; a run's own output capture is
  unchanged. (#34)

## [0.2.4] - 2026-09-12

### Added

- `@qvac/harness/worker/stow-entry.mjs`: a sidecar entry a host running from
  inside `node_modules` spawns directly, without the prebuilt bundle. Every
  native addon then resolves beside the JS that calls it, from one install.

  With the bundle, the addons come from the host's own install, and a version
  skew there hangs the child on boot rather than throwing: `@qvac/core` 0.1.2
  shipped that way. The bundle stays published for a host that relocates the
  code out of `node_modules`. (#31)

  ```js
  import { harnessChild } from '@qvac/harness/lib/spawn.ts'

  const entry = new URL(import.meta.resolve('@qvac/harness/worker/stow-entry.mjs')).pathname
  const spec = harnessChild(entry, {
    runner,
    skillsDir,
    wheelsDir,
    sdkStorage: storage.sdk
  })
  ```

## [0.2.3] - 2026-09-12

### Added

- A duplex handler's frames now type without a local widening:
  `schema/generate` emits `writeStream` on the generated `HandlerFrames`.
  (#29)

  ```js
  // in a generated spec, a duplex handler can watch its write side close
  frames.writeStream?.on('close', onClose)
  ```

### Changed

- Models download on Android and iOS. `resolveStorage` keeps them under the
  app's own persistent root there, instead of the device HOME, which an app
  cannot write. Desktop and Snap are unchanged, and `overrides.models` still
  wins. (#29)

  ```js
  import { resolveStorage } from '@qvac/harness/storage'

  const storage = resolveStorage('prod')
  // mobile: <persistent root>/.qvac/models
  storage.sdk.models
  ```

### Fixed

- The mobile worklet's file tools load again. Every `./lib/tools/*` subpath is
  published now; the tarball listed only the ones `qvac-core` imports, so
  `file-glob`, `grep`, `read-files`, `create-documents`, `edit-documents` and
  `fs/scope` failed with `PACKAGE_PATH_NOT_EXPORTED`. 0.1.1 to 0.2.2 are
  affected. (#29)

## [0.2.2] - 2026-09-11

### Fixed

- The engine bundle runs on the patched `@qvac/inference` 0.19.0 the harness
  pins, and nothing else. A stale lockfile entry had given `@qvac/sdk` its own
  nested `@qvac/inference` 0.19.1 beside it. A packaging fix with no API
  change. (#27)

## [0.2.1] - 2026-09-11

### Fixed

- The generated wire spec matches the schema it is built from again. 0.2.0
  stamped the fields it added (`downloaded` on a download event and as a model
  status, and `kvCacheKey`) with schema version 7, the version 0.1.2 already
  shipped. They are version 8 now. Only the generated spec changed; no API
  change. (#25)

## [0.2.0] - 2026-09-11

### Added

- `deleteKvCache(kvCacheKey)` deletes one chat's KV cache: every file kept
  under that key. `clearKvCache()` still deletes them all.

  It is safe on a key still in use: the next turn under it primes from scratch.
  It rides a new `delete-kv-cache` hrpc route, and resolves with `{ status }`
  like `clearKvCache`. (#22)

  ```js
  // the cacheKey the chat's completions ran under
  const result = await harness.deleteKvCache(cacheKey)
  if (result.status !== 'success') log(result.error)
  ```

- A host can tell a fresh download from a model already on disk. A download's
  `complete` event carries `downloaded`: `true` when bytes were fetched,
  `false` when the model was already there.

  An image model's `model` events report `loading` rather than `downloading`
  when it is cached, and a new `downloaded` status once a fetched one has
  loaded, so a host that switches over `status` has one more case. (#22)

  ```js
  for await (const event of harness.download({ model })) {
    if (event.type === 'complete' && event.downloaded) notifyDownloaded(model)
  }

  harness.on('model', ({ model, status }) => {
    if (status === 'downloaded') notifyDownloaded(model)
  })
  ```

- `ToolDefinition.prompt` lets a tool show the model a shorter schema: an
  optional compact `description` and `parameters` sent in place of the full
  ones, which still validate the call. `exec` and `skill` ship one, so every
  turn spends less of the prompt on their schemas. (#22)

  ```js
  const lookup = {
    name: 'lookup',
    description: 'Look a record up by its id, and return ...',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The record id ...' } },
      required: ['id']
    },
    // what the model sees; the full schema above still validates the call
    prompt: {
      description: 'Look a record up by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    },
    toolset: null,
    effect: () => 'read',
    execute: async ({ id }) => find(id)
  }
  ```

- `CONTEXT_OVERFLOW_MESSAGE` is exported: the message a turn fails with when it
  does not fit the model's context window. A host can tell that failure apart
  and compact the chat. (#22)

  ```js
  import { CONTEXT_OVERFLOW_MESSAGE } from '@qvac/harness'

  if (event.type === 'error' && event.message === CONTEXT_OVERFLOW_MESSAGE) {
    compact(chat)
  }
  ```

- With `QVAC_HARNESS_LOG=1`, each turn logs `sdk tool definitions`: the tool
  schemas it sent, largest first, with each one's size and the skill that
  granted it. (#22)

  ```sh
  QVAC_HARNESS_LOG=1 bare host.js
  ```

### Changed

- `@qvac/sdk` 0.19.0, pinned exactly. Under Bare the SDK is now served by
  `@qvac/inference` 0.19.0, through a new `#sdk` import alias.

  `@qvac/audiogen-ggml` joins the deferred addons, so
  `prebuilds-manifest.json` names it and the host provides it too. (#22)

- Image and music generation schemas reach the model once their skill's
  instructions are loaded, not as soon as the skill is enabled. Loading the
  skill unlocks them within the same turn, at the cost of one cache re-prime
  on that round. (#22)
- `@qvac/skills` 0.1.3: the weather skill keeps the place exactly as the user
  wrote it, asks back on an ambiguous city name, and reports a failed lookup
  instead of a temperature it never received. (#22)
- `bare-http1` is pinned to 4.5.9, as a dependency and as an override.
  (#22, #24)

## [0.1.2] - 2026-09-11

### Fixed

- `configureSdkStorage()` runs under Bare again.
  `@qvac/harness/sdk-storage` and `@qvac/harness/sdk-config-loader` failed to
  resolve there with `MODULE_NOT_FOUND`, because the tarball carried only the
  Node loader behind `#sdk-config-loader`. Both loaders ship now. 0.1.1 is
  affected. (#20)

  ```js
  // Bare: loads again, nothing else changes
  import { configureSdkStorage } from '@qvac/harness/sdk-storage'
  ```

## [0.1.1] - 2026-09-10

### Added

- `@qvac/harness` and its subpaths now import from npm under plain Node or
  Bare, with no TypeScript source or type-stripping loader. The library surface
  ships compiled: `dist-lib/` carries JavaScript and a `.d.ts` for every
  export.

  Export keys are unchanged, `.ts`-suffixed deep paths included, so a host that
  took the library from the repository switches to the package without editing
  a specifier. Of `./lib/tools/*`, only the paths `qvac-core` imports are
  published. (#18)

  ```js
  import { harnessChild, spawnHarness } from '@qvac/harness/lib/spawn.ts'
  import { AbortedError, raceAbort } from '@qvac/harness/race-abort'
  ```

## [0.1.0] - 2026-09-10

### Added

- First release of the QVAC engine as `@qvac/harness`. A host gets the
  prebuilt engine, `dist/harness.bundle` (one bundle for every platform), and
  the generated `dist/harness.cjs` it requires to spawn that bundle as a
  bare-sidecar process.

  The package spawns; it does not import. Its export map points at library
  source the tarball leaves out, so a host takes `spawnHarness`,
  `harnessChild` and the transport from the repository until a compiled
  surface ships. See
  [The npm artifact spawns; it does not import](https://github.com/tetherto/qvac-harness/blob/v0.1.0/README.md#the-npm-artifact-spawns-it-does-not-import)
  and [Spawning](https://github.com/tetherto/qvac-harness/blob/v0.1.0/README.md#spawning).
  (#13)

  ```js
  const harness = require('@qvac/harness/dist/harness.cjs')

  const { ipc, sidecar, exit } = await harness.start(args)
  ```

- `dist/prebuilds-manifest.json` tells a host which native prebuilds to supply.
  It names every prebuild directory the bundle defers, keyed by its path
  relative to the bundle. The host assembles those beside the bundle from its
  own `node_modules`, and installs the `@qvac` inference addons and `pyodide`
  alongside. (#13)
- Skills come from `@qvac/skills` 0.1.2, a content-addressed bundle the
  harness materializes at runtime. The Python wheels the tool runtime installs
  ship in `wheels/`, each pinned by hash in `wheels/manifest.json`. (#13, #15)
- Every dependency installs from the public npm registry: GPU stats are read
  through `bare-gpu-info`. (#12)

[Unreleased]: https://github.com/tetherto/qvac-harness/compare/v0.8.12...HEAD
[0.8.12]: https://github.com/tetherto/qvac-harness/compare/v0.8.11...v0.8.12
[0.8.11]: https://github.com/tetherto/qvac-harness/compare/v0.8.10...v0.8.11
[0.8.10]: https://github.com/tetherto/qvac-harness/compare/v0.8.9...v0.8.10
[0.8.9]: https://github.com/tetherto/qvac-harness/compare/v0.8.8...v0.8.9
[0.8.8]: https://github.com/tetherto/qvac-harness/compare/v0.8.7...v0.8.8
[0.8.7]: https://github.com/tetherto/qvac-harness/compare/v0.8.6...v0.8.7
[0.8.6]: https://github.com/tetherto/qvac-harness/compare/v0.8.5...v0.8.6
[0.8.5]: https://github.com/tetherto/qvac-harness/compare/v0.8.0...v0.8.5
[0.8.0]: https://github.com/tetherto/qvac-harness/compare/v0.7.3...v0.8.0
[0.7.3]: https://github.com/tetherto/qvac-harness/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/tetherto/qvac-harness/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/tetherto/qvac-harness/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/tetherto/qvac-harness/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/tetherto/qvac-harness/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/tetherto/qvac-harness/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/tetherto/qvac-harness/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/tetherto/qvac-harness/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/tetherto/qvac-harness/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/tetherto/qvac-harness/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/tetherto/qvac-harness/compare/v0.2.12...v0.3.0
[0.2.12]: https://github.com/tetherto/qvac-harness/compare/v0.2.11...v0.2.12
[0.2.11]: https://github.com/tetherto/qvac-harness/compare/v0.2.10...v0.2.11
[0.2.10]: https://github.com/tetherto/qvac-harness/compare/v0.2.9...v0.2.10
[0.2.9]: https://github.com/tetherto/qvac-harness/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/tetherto/qvac-harness/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/tetherto/qvac-harness/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/tetherto/qvac-harness/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/tetherto/qvac-harness/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/tetherto/qvac-harness/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/tetherto/qvac-harness/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/tetherto/qvac-harness/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/tetherto/qvac-harness/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tetherto/qvac-harness/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/tetherto/qvac-harness/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tetherto/qvac-harness/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tetherto/qvac-harness/releases/tag/v0.1.0
