<p align="center">
  <img src="docs/assets/ducks.png" alt="" width="200">
</p>

<h1 align="center">@qvac/harness</h1>

<p align="center">
  <b>The agent harness for local models</b>
  <br>
  Tools, agents, sandboxes and resumable runs on your own device
</p>

<p align="center">
  on-device GGUF models &middot; Bare and Node &middot; agents that hand off and delegate &middot;
  parallel tools and runs &middot; sandboxed exec &middot; crash-proof sidecar &middot;
  resume after process death
</p>

<p align="center">
  <a href="#how-it-works">How it works</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#plugins">Plugins</a> &middot;
  <a href="#examples">Examples</a> &middot;
  <a href="#host-it">Host it</a> &middot;
  <a href="#development">Development</a>
</p>

```sh
npm i @qvac/harness @qvac/sdk
```

```ts
import { Harness, QWEN_35_2B } from '@qvac/harness'

const harness = new Harness()
const messages = [{ role: 'user', content: 'Reply with one word: hi' }]
for await (const event of harness.completion({ model: QWEN_35_2B, messages })) {
  if (event.type === 'content') {
    process.stdout.write(event.text)
  }
}

await harness.close()
```

That is the whole API surface for a chat: **context in, events out.** The model is a GGUF that the
QVAC SDK runs on this device: no server and no API key, and the prompt never leaves it.

## How it works

```
  your app                           @qvac/harness  (in process, a child process, or a Bare thread)
 ┌────────────┐  completion(context) ┌──────────────────────────────────────────────────────────┐
 │            │ ───────────────────► │  agent ──► prompt ──► model (QVAC SDK, llama.cpp)        │
 │  UI        │                      │    ▲                       │ tool calls                  │
 │            │ ◄─────────────────── │    │                       ▼                             │
 │  approve() │   content, tool-call │    │   guards ──► approve? ──► tools, plugins, agents    │
 └────────────┘   transfer, metrics  │    └────────── results ◄───────────┘   (one round)      │
                                     └──────────────────────────────────────────────────────────┘
```

A completion is a loop of **rounds**. In each round the model answers or calls tools. Every call is
checked against its schema and the run's grants, sorted into a read or a write, sent to your
`approve` if it writes, then run, and its result goes back to the model. The run ends when the model
answers, a budget runs out, or it hands the conversation to another agent.

The loop is a state machine (`lib/machine/`), and every step is journaled. So a run can pause for
approval, survive the process dying, and pick up where it stopped. `bun run example resume` kills a run at
its approval and resumes it; see [The loop is a state machine](examples/resume/README.md#the-loop-is-a-state-machine).

**Built for small models.** A 2B model makes mistakes a cloud model does not. The harness repairs
broken tool-call markup, coerces arguments to their schema, re-asks when the model describes a call
instead of making it, trims long tool output and spills the rest to a file the model can read, and
folds old turns into a summary when the context fills. The KV cache is reused across rounds and
runs, so a long chat does not prefill its whole history again.

## Features

### Tools you control

A tool is a plain object. You decide what is a read and what is a write; writes go through `approve`.

```ts
const stock: ToolDefinition = {
  name: 'stock',
  description: 'Units in stock for one SKU',
  toolset: null,
  parameters: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
  effect: () => 'read',
  // reads marked concurrent run side by side in one round
  concurrent: true,
  execute: (args) => Promise.resolve({ content: String(inventory[String(args.sku)] ?? 0) })
}

harness.completion({ model, messages, tools: [stock], approve: (call) => askTheUser(call) })
```

Built-in tools read and edit files only inside folders you grant (`grantedDirs`,
`grantedWriteDirs`), and never inside the app's own storage. They also read, edit and create Word,
Excel, PowerPoint and PDF files on device, in TypeScript, with no Python and no cloud.

### Large tool sets, on demand

Mark a tool `defer: true` and the model sees only its name, grouped under `group`, until it calls
`tool_search` to load it. The loaded schema is appended to the history, so the prompt prefix stays
cached; an MCP server takes `defer: true` for all its tools, and a run takes `deferTools: true` for
every tool but `skill`. A 2B with fifty tools no longer reads fifty schemas every round.

```ts
const lookup: ToolDefinition = {
  ...stock,
  name: 'warehouse_lookup',
  defer: true,
  group: 'warehouse'
}
```

### Agents that hand off

An agent is a prompt, tools and skills, and may name its own `model`. Give it `handoffs` and it can
pass the conversation on: here a health question goes to an agent on MedPsy, a medical model. Each
hop is its own run, with its own `runId`, and emits a `transfer` event.

```ts
const triage = {
  id: 'triage',
  bio: 'You route each request to the right agent.',
  handoffs: [
    { id: 'office', description: 'Word, Excel and PDF documents' },
    { id: 'health', description: 'Symptoms, medicines and wellbeing' }
  ]
}
const agents = {
  office: {
    bio: 'You write and edit documents.',
    handoffs: [{ id: 'triage', description: 'Anything that is not a document' }]
  },
  // a medical model of its own; the others run on the run's model
  health: { model: MEDPSY_1_7B, bio: 'You answer health questions clearly.' },
  triage
}
for await (const event of harness.completion({ model, agent: triage, agents, messages })) {
  if (event.type === 'transfer') {
    console.log(`${event.from} -> ${event.to}: ${event.reason}`)
  } else {
    render(event)
  }
}
```

### Agents as tools

`delegate` lets an agent send several self-contained tasks to subagents and get every answer back.
They run on the same loaded model, as many at once as `delegateTool` is given `slots` and the
harness has. A subagent sees only its task, and cannot delegate or hand off.

```ts
import { Agent } from '@qvac/harness/agent'

const explorer = { id: 'explorer', bio: 'You answer one question about the code.' }
const base = { model, agent: explorer, messages: [], grantedDirs: [projectDir] }
const delegate = Agent.delegateTool(harness, base)
harness.completion({ model, messages, tools: [delegate], grantedDirs: [projectDir] })
```

### Hand the hard parts to Claude Code

The same `delegate` tool can reach agents outside the harness: Claude Code, Codex, or anything that
speaks ACP. Each task runs in a fresh process in the run's granted folder, and asks your `approve`
first.

```ts
import { ExternalAgents } from '@qvac/harness/plugins/external-agents'

const targets = ExternalAgents.targets({
  dir: agentsHome,
  targets: [
    {
      name: 'claude',
      description: 'Claude Code, for a hard change that needs a stronger model',
      protocol: 'claude',
      command: '/usr/local/bin/claude',
      // your own Claude Code sign-in and settings; leave it out to run isolated on an API key
      login: 'user'
    }
  ]
})
const delegate = Agent.delegateTool(harness, base, { targets })
```

### Plans and goals

`plan: true` gives an agent `update_plan`, a checklist it sees after every round. A `goal` keeps the
run going until every step is done or a budget runs out. A goal's `checks` are commands the result
is judged by, and until they pass each goal turn names the check and the output of its failed run.
On a run with a tool that takes a `command`, the model must also name its own checks under a
`Checks:` line, and the goal is met only once every check, the host's and the model's, ran in a
call's `command` and exited 0, so host checks alone never meet it. `checksProve: true` says the host
checks prove the task: the goal is met on them alone and the model is not asked for its own. It has
no effect without checks. With no tool that takes a `command` and no host checks, the goal ends when the plan is done; host
checks need a tool that takes a `command`, or the goal runs to its budget.
`planMode` refuses writes until the user approves the plan.

```ts
const agent = { id: 'lead', bio: 'You are the lead engineer.', plan: true }
const goal = { objective: 'All tests pass', rounds: 30, checks: ['npm test'], checksProve: true }
harness.completion({ model, agent, messages, goal })
```

### Steer a run while it works

Send turns into a running completion. A steer lands at the next tool boundary; a follow-up continues
the run after its answer.

```ts
async function* input() {
  yield { mode: 'steer' as const, text: 'Use the v2 endpoint instead' }
}
harness.completion({ model, messages, input: input() })
```

### Parallel

Concurrent reads in one round run side by side. `slots` lets one loaded model decode several
completions at once, each with its own context: on the 2B, four requests at `slots: 4` decode about
30% more tokens a second in all, and each starts in about 0.2 s instead of queueing for 2 s.

```ts
const harness = new Harness({ slots: 2 })
const [a, b] = await Promise.all([ask(harness, 'Summarize A'), ask(harness, 'Summarize B')])
```

### Sandboxed code

`exec: true` gives the model a shell, and plugins decide where it runs: under macOS Seatbelt, in a
VM, or as JavaScript in QuickJS with no files or network. Python runs in Pyodide. For real coding
work, `CodingPlugin` adds a shell that keeps its place and background jobs, run
inside Seatbelt on macOS.

```ts
const harness = new Harness({
  exec: true,
  policy: { preset: 'workspace-write' },
  plugins: [new SeatbeltSandbox(), new QuickJs()]
})
```

### Runs that survive a crash

Spawned with `spawnHarness`, the harness runs as a supervised child process, so a llama.cpp crash
kills the AI and never the app. Every step of a run is journaled; after the process dies, send the
same `runId` with `resume: true` and the run carries on. See [Resuming a completion](docs/resuming.md).

### Know how fast it is

Every completion ends with a `metrics` event: prefill and decode tokens per second, time to first
token, per round and per run. Each loaded model reports the engine's own fit verdict and its device
and host bytes in `diagnostics().models`. See [Speed stats](docs/speed-stats.md). Accuracy is measured on real
benchmarks (BFCL, τ²-bench, Terminal-Bench) in [bench](bench/README.md).

## Plugins

A plugin is an instance you pass in `plugins`. Its options are its constructor's argument, and the
host grants its reads there too: `new Weather({ read: ['weather_lookup'] })`. A plugin never grants
itself.

| Plugin                                                     | Adds                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`ExternalAgents`](plugins/external-agents/README.md)      | Claude Code, Codex or any ACP agent as a `delegate` target                                       |
| [`WalkieTalkie`](plugins/walkie-talkie/README.md)          | Two-way comms with agents and people on other machines, over Hyperswarm                          |
| [`RunReport`](plugins/run-report/README.md)                | A run as a flowchart played back step by step, with why; records through `hopLog`, not `plugins` |
| [`CodingPlugin`](plugins/coding/README.md)                 | A shell that keeps its place, background jobs                                                    |
| [`LspPlugin`](plugins/lsp/README.md)                       | Definitions, references, symbols and diagnostics from language servers                           |
| [`McpPlugin`](plugins/mcp/README.md)                       | The tools of any HTTP MCP server                                                                 |
| [`CodeMode`](plugins/code-mode/README.md)                  | `run_code`: a script that calls the other tools                                                  |
| [`QuickJs`](plugins/quickjs/README.md)                     | JavaScript for `exec`, with no files or network                                                  |
| [`Python`](plugins/python/README.md)                       | Python for `exec`, in Pyodide                                                                    |
| [`SeatbeltSandbox`](plugins/sandbox-macos/README.md)       | `exec`'s shell under macOS `sandbox-exec`                                                        |
| [`VmShell`](plugins/sandbox-vm/README.md)                  | `exec`'s shell in a VM with no network or disk                                                   |
| [`AppContainerSandbox`](plugins/sandbox-windows/README.md) | `exec`'s shell in a Windows AppContainer                                                         |
| [`LinuxSandbox`](plugins/sandbox-linux/README.md)          | `exec`'s shell under Linux bubblewrap                                                            |
| [`CommandHooks`](plugins/command-hooks/README.md)          | The command hooks of a Claude Code `settings.json`                                               |
| [`Knowledge`](plugins/knowledge/README.md)                 | Search over the user's documents                                                                 |
| [`WebSearchPlugin`](plugins/web-search/README.md)          | Web search across several engines                                                                |
| [`Speech`](plugins/speech/README.md)                       | Transcription, text to speech, and MOSS voice cloning and dialogue                               |
| [`Image`](plugins/image/README.md)                         | Image generation and editing                                                                     |
| [`Music`](plugins/music/README.md)                         | Music generation                                                                                 |
| [`TranslationPlugin`](plugins/translation/README.md)       | Translation on device                                                                            |
| [`LanguageHint`](plugins/language-hint/README.md)          | A prompt in another language, in English too, for the model                                      |
| [`Weather`](plugins/weather/README.md)                     | Weather lookup                                                                                   |
| [`ObsidianRoute`](plugins/obsidian/README.md)              | `obsidian …` commands against a vault                                                            |

Each plugin is imported from `@qvac/harness/plugins/<folder>`. Its own dependencies are optional
peers of `@qvac/harness`: a host installs the ones for the plugins it imports
(`npm i @qvac/asr-ggml @qvac/tts-ggml bare-ffmpeg` for `Speech`), and importing a plugin without
them throws an error naming them. The shipped sidecar entry composes speech, image, music,
translation and python, so a host that spawns it installs all of their peers; a host that wants
fewer writes its own entry with only those plugins. See
[Plugin dependencies](docs/hosting.md#plugin-dependencies) for each plugin's peers.

Writing your own takes one object:

```ts
import { Harness, PLUGIN_API_VERSION, type HarnessPlugin } from '@qvac/harness'

const clock: HarnessPlugin = {
  name: 'clock',
  api: PLUGIN_API_VERSION,
  setup: () => ({ tools: [timeTool] })
}

const harness = new Harness({ plugins: [clock] })
```

`setup` returns tools, hooks, services and `exec` contributions. See the
[plugin framework](lib/plugins/README.md) and a [custom plugin](examples/custom-plugin/README.md).

## Examples

Each runs on a local model under `QVAC_MODEL_CACHE_PATH` (`~/.qvac/models` by default).
`test/examples.ts` proves code-assistant, subagents, handoffs, parallel and custom-plugin on a
scripted model; host needs a spawned Bare child and a model, so it has no test. More in
[examples/](examples/README.md).

| Run                              | Shows                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun run example code-assistant` | [A coding team](examples/code-assistant/README.md): plan, subagents, review, Claude Code |
| `bun run example subagents`      | A lead handing one file to each subagent, four reading at once                           |
| `bun run example handoffs`       | A triage agent handing a memo to an office agent, and a health question to one on MedPsy |
| `bun run example parallel`       | Three tools in one round, and two runs on one model                                      |
| `bun run example custom-plugin`  | [A third-party plugin](examples/custom-plugin/README.md): tools, a hook, a service       |
| `bun run example host`           | Hosting the harness as a sidecar, the way a desktop app does                             |

## Host it

Run it in your process with `new Harness()`, or as a supervised sidecar, so a model crash never
takes down your app:

```ts
import { spawnHarness } from '@qvac/harness'

const harness = spawnHarness({ entry, sdkStorage })
```

The sidecar speaks the same `completion(context)` over hrpc. [`@qvac/core`](https://github.com/tetherto/qvac-core)
takes it unchanged to run agents across your devices; see its
[Integrating a harness](https://github.com/tetherto/qvac-core#integrating-a-harness).

A React Native screen talks to a harness served in a Bare worker with `HarnessClient` from
`@qvac/harness/client`, whose imports load no built-in module; see
[the harness in a pear-mobile app](examples/mobile/README.md). A browser renderer must also alias
`events` to `bare-events`.

## Reference

- [Hosting](docs/hosting.md): what the package ships, spawning, freeing memory, the memory cap, holding downloads, office extraction.
- [Architecture](docs/architecture.md): the engine layout and each module's API.
- [Resuming a completion](docs/resuming.md): the host run log, process death, the tool-call grammar.
- [Custom models](docs/custom-models.md): run a GGUF the catalog does not carry.
- [Speed stats](docs/speed-stats.md) and [benchmarks](bench/README.md).
- [Decisions](docs/decisions/INDEX.md): why the harness is built the way it is.

## Development

```sh
bun install
bun run lint          # prettier + lunte + tsc
bun run test          # brittle, bare, node and addon lanes
bun run build:schema  # regenerates spec/
```

## License

See [LICENSE](./LICENSE.md).
