<p align="center">
  <img src="ducks.png" alt="" width="200">
</p>

<h1 align="center">@qvac/core</h1>

<p align="center">
  <b>Peer-to-peer AI across your devices</b>
  <br>
  Run on mobile, desktop or remotely via P2P magic
</p>

<p align="center">
  delegated inference &middot; replicated agents, chats and skills &middot; approve or
  stop from anywhere &middot; works offline &middot; no servers
</p>

<p align="center">
  <a href="#integrating-a-harness">Harness</a> &middot;
  <a href="#what-you-get-for-free">What you get</a> &middot;
  <a href="#one-shot-tasks">Tasks</a> &middot;
  <a href="#rendering-the-chunk-stream-any-ui">Chunk stream</a> &middot;
  <a href="#harness-event-reference">Events</a> &middot;
  <a href="#development">Development</a>
</p>

A P2P, multi-device AI workbench core. Three pieces, one duplex stream:

- **`Core`** — the state authority. Owns the replicated mesh (agents, devices,
  the chunk stream) and the device-local store, serves every capability over
  hrpc. It contains **no AI whatsoever**.
- **`Client`** — the client. A thin proxy whose methods are generated from the
  schema; everything an app (or an assistant) does goes through it.
- **`QvacAssistant`** — the execution host. Owns _your_ AI harness and drives
  it purely through the Client's capability surface, exactly like any other
  client. This is the only place inference happens.

```
┌───────────── host app process ─────────────┐      ┌── sidecar / same process ──┐
│  UI ──► Client ◄── QvacAssistant ◄─ Harness│ ◄──► │ Core ◄──► mesh (other devices)
└────────────────────────────────────────────┘      └────────────────────────────┘
```

## Install

```sh
npm i @qvac/core
```

The library is the three pieces above — start at
[Integrating a harness](#integrating-a-harness). Runnable examples live in
[`examples/`](./examples/README.md); `bun run mesh-two-people` is the shortest
one, and shows what a device invite does that a member invite does not.

## Integrating a harness

A harness is one method. Implement `completion(context)` as an async iterable
of plain events and you are done — no knowledge of chunks, meshes, or RPC:

```js
const harness = {
  async *completion({ model, agent, messages, approve, signal }) {
    // Call any model you like — llama.cpp, an HTTP API, a test fake…
    const reply = await myModel.chat({ system: agent.bio, messages })
    yield { type: 'content', text: reply }
  }
}
```

Wire it up — prod shape, Core in its own Bare sidecar process:

```js
import { QvacAssistant, AssistantClient } from 'qvac-core'

// Spawns the bundled Core sidecar for free — ready() boots it, close()
// tears it down. Joining an account: redeem a device invite with joinMesh.
const engine = new AssistantClient({
  storagePath: '/path/to/state',
  device: { name: 'my-device', capabilityProfile: 'mid', recommendedModelName: 'Qwen3.5-9B' }
})
await engine.ready()

const assistant = new QvacAssistant(engine, harness)
await assistant.ready()
```

No `Core` construction host-side at all — the sidecar entry boots it, your
process keeps only the Client, the assistant, and the model runtime. Pass
`entry` in the options to replace the bundled Core entry with your own.

For tests or a single-process host, `sidecar: false` boots the same Core
in-process from the same options — nothing else changes:

```js
const engine = new AssistantClient({ sidecar: false, storagePath, device })
await engine.ready() // engine.core is the in-process Core (null in sidecar mode)
```

(Lower still, `Core`/`Client` construct directly over any duplex pair —
that's all either mode does.)

Either way that's the whole integration — the assistant can't tell the
difference, because it only ever speaks capabilities. It is a
`ready-resource`: `ready()`, `close()`, `suspend()`/`resume()` (mobile
backgrounding — stops taking new work; in-flight runs finish).

The real llama.cpp harness lives in `../assistant-harness` and implements this
same contract.

### The harness over a wire (desktop / mobile)

In-process is for tests and simple hosts. Real apps put the harness where
the model runtime belongs, behind the `qvac-harness` wire contract
— the same `Harness` object served on a pipe, and a `RemoteHarness` handle
the assistant takes unchanged. The rule: **colocate the harness with
wherever the SDK runs in-process.**

**Desktop (Electron)** — the harness gets its own OS process, so a llama.cpp
crash or OOM kills the AI, never the mesh or the app. The whole local stack
is three lines — `spawnHarness()` spawns the bundled llama.cpp harness
sidecar and hands back the handle the assistant takes unchanged:

```js
import { QvacAssistant, AssistantClient } from 'qvac-core'
import { spawnHarness } from 'qvac-harness'

const engine = new AssistantClient({ storagePath, device })
const harness = spawnHarness({ entry, skillsDir, sdkStorage, logger })
const assistant = new QvacAssistant(engine, harness)
await assistant.ready()

harness.on('status', (s) => log.warn('harness', s)) // running / died, lives
// shutdown: harness.close() kills the spawned process
```

Custom tool sets: pass your own `entry` to `spawnHarness` (the bundled entry
is `qvac-harness/worker/harness-sidecar.mjs` — two lines of
`serveHarness(Bare.IPC, new Harness({ tools }))` to copy).

**Mobile (React Native + bare-kit)** — worklets share the app process, so a
separate harness worklet buys no isolation and costs a hop; the harness
lives in the Core worklet (or speaks to the SDK's own worklet over its
pipe). Same contract, an in-worklet duplex instead of a spawn:

```js
// inside the Core worklet: Core + harness + assistant, one process
import { QvacAssistant, duplexPair } from 'qvac-core'
import { Harness, serveHarness, connectHarness } from 'qvac-harness'

const [serverEnd, clientEnd] = duplexPair()
serveHarness(serverEnd, new Harness({ tools }))
new QvacAssistant(
  client,
  connectHarness(() => clientEnd)
)
```

**Death is death** (day one, like v1): a harness death fails the in-flight
run with a `HARNESS_DIED` reason and fails every later call fast — never a
hang. The `'status'` events and `harness.lives` are in-memory observability;
restart/recovery policy lands on that plumbing later. The wire contract also
carries `agent.id`, so a harness scopes per-agent tool config/credentials
locally (a work agent's gmail never leaks to a personal agent) — that config
never crosses the wire or touches the mesh. See `../harness-rpc/README.md`
for the contract itself.

## What you get for free

Because every part of a run is a replicated chunk, the assistant inherits the
whole multi-device story without any harness code:

- **Delegation** — agents live on the mesh with a `providerDeviceId`. Any
  device asks (`engine.runAgent({ meshId, chatId, agentId })` appends a `run-request`
  chunk); the device that _provides_ the agent executes; every chunk streams
  back to everyone. A request made while the provider is offline runs when it
  returns. Asking requires no harness at all.
- **Approval** — `await approve(call)` inside your harness surfaces as an
  approval-request chunk on every device; ANY of them may answer
  (`engine.resolveApproval`), first decision wins, and your promise resolves.
  A run that dies with an unanswered request auto-denies it — no peer ever
  sees a forever-pending ask. Tools marked `autoApprove` skip the gate.
- **Stop** — any device may stop any run: `engine.stopRun` writes the
  terminal `canceled` run-status itself (no executor needed — it settles an
  orphaned run too); an executing harness's `signal` fires when the status
  replicates to it, and it writes nothing more.
- **Model progress** — emit `'model'` events (`loading`/`downloading`/`ready`)
  from your harness (plain EventEmitter) and every device watching the run
  sees load/download progress, coalesced.
- **Metrics** — yield one `{ type: 'metrics', ... }` event and it lands on the
  completed run-status chunk, replicated.
- **Crash safety** — the first run-status chunk is the replicated claim
  marker: a restarted assistant never re-executes a run that already started.

## One-shot tasks

A chat is a conversation; a task is one question with one answer. `runTask`
composes the append/run/watch flow into a single await — no streaming, no chunk
bookkeeping — and resolves once the run settles:

```js
import { runTask } from 'qvac-core/task'

const result = await runTask(engine, { meshId, agentId: agent.id, prompt: 'Say hi' })

result.state // 'completed' | 'failed' | 'canceled'
result.text // the answer: content after the last tool result, trimmed
result.thinking // kept apart from the answer
result.toolCalls // [{ name, arguments }]
result.attachments // what the run produced
result.sources // RAG hits the run cited
result.reason // why, when state is not 'completed'
result.chunks // the run's raw chunks, for anything the above flattened
```

A run that calls a tool interleaves content around `tool-call` / `tool-result`,
so `text` is the content after the last tool result — the model narrating its
way there is in `chunks`, not in the answer.

It opens its own chat, titled from the prompt; pass `chatId` to continue an
existing one instead. A failed or canceled run resolves like any other — the
outcome is in `state`, so nothing hangs waiting for an answer that is not
coming.

`skill: 'presentations'` forces that skill into the turn. It rides the same
`@mention` channel a user types, so the harness inlines the skill's
instructions into the message rather than leaving the model to call the loader
— and it overrides the agent's `enabledSkills`, which readiness alone gates.
One skill per task: the mention is the first token of the message.

## Rendering the chunk stream (any UI)

The engine exposes a snapshot chat catalog:

```js
const { chats } = await engine.listChats({ meshId })
```

Every mesh-backed route names the mesh it acts on: a device holds several at once
and Core keeps no current one. It returns that mesh's chat rows in sidebar order,
bottom first
(clients reverse to render): a chat sits where the user last dragged it
(`moveChat`) until a chunk lands in it, then most-recently-active wins; `id`
breaks ties. Groups ride the same frame, top first (`moveChatGroup` orders
them). Recency is derived from the chunk counter and costs no write, but it is
part of the row, so `chatsWatch` re-emits on any change to the rendered list:
create, rename, delete, flag, placement, or a chunk landing. The existing
replicated chat encoding uses zero as the default for an absent optional
`deletedAt`, so `deletedAt: 0` is not a representable tombstone and is treated
as active. Positive tombstone timestamps are excluded.
`listChats()` itself is a snapshot query. Chat create, update, delete, and watch
capabilities are available through the typed chat API.

### Chat activity

Derived per-chat run state rides its own lean stream so it never churns the
metadata list:

```js
const { activities } = await engine.listChatActivity({ meshId }) // or engine.chatActivityWatch({ meshId })
```

Each row is just `{ id, activityState }` — a small state machine over the chat's
replicated runs:

- `queued` — a run requested but not yet executing.
- `running` — generic compute (thinking, responding, an ordinary tool call).
- `generating-image` / `generating-audio` / `transcribing-audio` — the active run
  refined by the media it is producing.
- `awaiting-approval` — the active run paused on the user.
- `awaiting-download` — the active run waits for a model the user has not let
  download yet (`autoDownloadModels` is off).

Every value is a mutually-exclusive state, not a parallel flag. Runs serialize
per chat, so at most one is executing. The list carries only active chats — a
chat absent from it is idle, so a busy list stays proportional to what's running
rather than to how many chats exist. Clients join these rows to `listChats` by
`id` and render the label per state, so the wire carries no words.

Pass `chatIds` to scope activity to a viewport: `chatActivityWatch({ chatIds })`
returns captions for only those chats, so a client watches what is on screen and
re-opens with a new window on scroll (chats it stops watching read as idle). An
empty or absent `chatIds` returns the whole active set.

The media states are the only phase detail on this stream, and they belong here
because they are coarse and boundary-driven — image generation is one long phase,
not a per-token flip. Core derives them from the run's `progress.phase` alone
(`generating` → image, or audio while the run's unsettled media tool is
`generate_music`; `transcribing` → transcription). A media tool whose model is
still downloading or loading reads as `running`, like every other model wait.
Everything finer stays off the list: the moment-to-moment phase
(thinking/responding, which non-media tool, the live percentage) is on the
per-chat chunk stream the open chat subscribes to, and model download/load
progress stays in `modelDownloadsWatch` (it reads as generic `running` here). So
`chatActivityWatch` broadcasts only at these coarse boundaries, and `chatsWatch`
stays silent through a run entirely.

### Notifications

`notificationsWatch()` merges device-local model completions with chat-derived
`assistant-reply`, `run-failed`, `approval-required`, and `user-message` events.
The newest 200 events are returned by default, with `truncated` when more remain.

Chat rows carry `chatId`, `agentId`, `chunkId`, `seq`, and `createdAt`, with an
optional 280-character preview and agent name. Human messages also carry
`senderDeviceId`, optional `senderMemberId`, `senderName`, and `chatTitle`.
Messages from this device or another device of the same member are suppressed;
without membership the sender falls back to device identity. Deleted chats and
automatic diagram repairs stay silent.

`ackNotification({ chatId, seq })` advances the local cursor monotonically.
Pending approvals stay visible until resolved, including when answered elsewhere.
Model rows carry `kind: 'model-downloaded'`, `notificationId`, `modelName`, and
`createdAt`; `ackNotification({ notificationId })` acknowledges that completion
without touching a chat cursor. One latest completion per model survives restart,
and an old acknowledgement cannot clear a newer download.

The Core-lifetime stream follows mesh transitions through lifecycle events and
keeps local model events available without a mesh. It ends on Core shutdown or
subscriber cancellation. Clients own notification copy, foreground suppression,
and operating-system delivery.

The assistant persists a logical transfer identity and completion separately from
download progress. Retries and suspension retain that identity. Completion waits
for required companion assets; cached discovery and 100% progress do not notify.
Core also emits `notification` wake events for terminal run-status,
approval-request, and user-message chunks.

A chat IS its chunk stream — one watch drives the whole view, and every
device renders the same thing because they all see the same chunks:

```js
const rows = new Map()
for await (const { reset, chunks = [], removed = [] } of engine.chunksDeltaWatch({
  meshId,
  chatId
})) {
  if (reset) rows.clear()
  for (const id of removed) rows.delete(id)
  for (const chunk of chunks) rows.set(chunk.id, chunk)
  render([...rows.values()].sort((a, b) => a.seq - b.seq))
}
```

The first frame is the whole chat; after that each frame carries only the rows
that changed, so a long streamed answer costs one row per chunk rather than the
whole chat each time. `chunksWatch` takes the same request and sends the full
list on every change, for a reader that wants it that way. A view over a long
chat also opens on a page and watches from its floor — see
[`chunksDeltaWatch`](docs/api/chunks.md#chunksdeltawatch). To render the rows,
group chunks into turns, then map each chunk type:

**Grouping.** A `user-message` (and an `attachment`) is its own user turn —
label it by `originDeviceId`, resolved to a name via `devicesWatch`. Every
chunk carrying a `runId` belongs to one assistant turn, anchored where its
`run-request` sits (that ordering matters: a message queued during a slow run
must sort before the reply that follows it).

**Per type:**

| chunk type         | render as                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user-message`     | the user's text (`chunk.userMessage.text`), labelled by device                                                                                                                                                                                                                                                                       |
| `run-request`      | nothing — it anchors the turn and marks "a run is in flight" before the provider even starts (`chunk.runRequest.agentId` names the agent)                                                                                                                                                                                            |
| `content`          | assistant text (`chunk.content.text`); consecutive content chunks concatenate into one bubble                                                                                                                                                                                                                                        |
| `thinking`         | collapsed/dimmed reasoning segment (`chunk.thinking.text`)                                                                                                                                                                                                                                                                           |
| `tool-call`        | `→ name(arguments)` line from `chunk.toolCall`                                                                                                                                                                                                                                                                                       |
| `tool-result`      | `← name: result` line from `chunk.toolResult` (collapse long results)                                                                                                                                                                                                                                                                |
| `attachment`       | file card from `chunk.attachment` (`fileName`, `mimeType`, `byteLength`); fetch bytes with `engine.downloadAttachment({ meshId, blobId })`                                                                                                                                                                                           |
| `approval-request` | **the chunk IS the approval state**, in the typed `chunk.approvalRequest` struct. `status === 'pending'` → show the ask (prefer `resource` — e.g. `host wttr.in` — over raw arguments) with allow / always-allow / deny; any other status → a resolved badge                                                                         |
| `run-status`       | turn lifecycle, in the typed `chunk.runStatus` struct: `executing` with a `progress` sub-struct (`phase` `loading`/`downloading`, `model`, `percentage` — edited in place on the one executing chunk, labelled by the chunk's `originDeviceId`); `failed` → error with `reason`; `completed` → done, `metrics` (tokens, tok/s, ttft) |

**Approval answers** go through `engine.resolveApproval({ chunkId, approved,
scope, expiresAt, meshId })` from ANY device — first decision wins, the flipped
chunk replicates to everyone. `scope: 'always'` also mints a standing
approval-rule from the request's tool + resource, so matching future calls
don't prompt anywhere until the rule expires — one hour by default; pass
`expiresAt` (ms since epoch) to grant longer or shorter
(`engine.listApprovalRules({ meshId })` shows what's remembered).

**Busy state** derives from the stream, not local flags: if the last
assistant turn has no terminal `run-status` (`completed`/`failed`/
`canceled`), a run is in flight somewhere — show the spinner on every device
and offer `engine.stopRun({ meshId, chatId, runId })`.

**Stopping** is a right of any device, not a request to the executor:
`stopRun` appends the terminal `canceled` run-status itself, so it settles a
run whether its provider is live, offline, or gone entirely (an orphaned
run's spinner). A live executor yields when the status replicates to it and
writes nothing more; if the run finished first, the stop is a no-op. The
first terminal status in seq order is always the run's one outcome.

**Orphaned agents.** Every agent from `listAgents`/`getAgent`/`agentsWatch`
carries a derived `orphaned` flag: its provider device row is gone or
revoked, so nobody can execute its runs until it's re-homed
(`updateAgent({ meshId, agentId, config: { providerDeviceId } })`). Render it as "waiting for
provider" — on the agent itself, and on a busy turn whose agent is orphaned
(that spinner will never resolve by itself). Device removal deliberately
does NOT delete the device's agents: their chats survive, and re-homing
brings them back.

## File status

`Mesh.files`, implemented in `lib/core/files/index.ts`, owns file access, local
processing state, and cleanup. Its internal modules expose one `index.ts` each:
Store handles bytes and ranges, Records handles the existing attachment and
knowledge surfaces, Processing owns worker lifetime, and RAG owns extraction,
artifacts, vectors, and retrieval. Removing a Knowledge entry preserves its
source while a live chat attachment still references it.

Browser clients keep using the pure `@qvac/core/rag/*` package exports; these
do not import the backend Files module.

`fileStatusWatch({ chatId })` returns a full snapshot of the chat's files, including
uploads still in progress. Each file has `fileId`, `state`, `readyForChat`, optional
`uploadProgress`, and `processors`. Each registered processor has an independent
queue, state and output identity. A processor outside a file's scope reports
`not-applicable`. Replacing the embedding model stops only RAG; other processors
continue for the lifetime of the mesh.

Source and output blobs download independently into local storage. An unavailable
file starts a background range download and yields its processing slot, so ready
files can proceed. Byte arrival wakes that file immediately, without waiting for
the retry timer or other downloads. These transfers have no 15-second cutoff;
deletion, suspension and shutdown cancel them. Each processor still limits its
CPU work to one job, and RAG production and repair share one embedding slot.

`Mesh.files` owns local processing, recovery, and readiness. Retrieval prioritizes
the current turn's attachments or named files, otherwise the chat's knowledge,
and waits up to five seconds total for indexing. A timeout leaves processing
running in the background for API searches. When a chat request attaches documents,
names pending files, or asks for a document overview, the reply then watches those
files until they are ready, failed or removed. It shows “Preparing documents…” and
refreshes retrieval before answering automatically; Stop closes that subscription.
Documents whose full text already fits the prompt need no index wait.
See the [cache and processing decision](docs/decisions/2026-07-15-vector-index-session-cache.md).

```ts
const statuses = engine.fileStatusWatch({ meshId, chatId })
statuses.on('data', ({ files }) => renderFileStates(files))

const upload = engine.uploadKnowledge()
upload.write({
  chatId,
  fileName: 'notes.txt',
  mimeType: 'text/plain',
  fileId,
  totalBytes: bytes.length
})
upload.write({ data: bytes })
upload.end()
for await (const receipt of upload) {
  if (receipt.knowledge) console.log(receipt.knowledge.id)
}
statuses.destroy()
```

The optional `fileId` must be unique and becomes the stored file ID. Omitting it
keeps server-generated IDs. Cancelled or failed uploads can reuse that ID once
the previous upload closes, provided no file was stored. Upload session details
expire one minute after closing; stored files remain visible.
Expiry stays private to the upload session. A supplied ID is reserved before
persisted-record validation, so concurrent uploads cannot acquire the same ID.
Both upload endpoints retain their existing progress
frames and final receipt. `uploadProgress.completed` counts original source bytes,
even when an image is normalized before storage. A missing or zero total means
unknown; do not calculate a percentage without a positive total.

Both endpoints share one upload path. A new Knowledge-panel document creates a
chat attachment and a knowledge row with the same ID and blob. Its receipt follows
both records, without waiting for indexing. The attachment belongs to the next
user message, allowing that question to read the document immediately. Removing
knowledge leaves the chat attachment downloadable until it is deleted too.
Direct `mesh.files.knowledge({ deviceId })` callers supply the uploader's device
identity; the Engine API supplies it without changing upload request frames.

Legacy panel-only rows can also be staged by their explicit ID, within their
original chat. Metadata reads need no blob bytes; unavailable bytes produce a
read error. This compatibility path writes no backfill or migration.

`fileRead({ chatId, fileId, metadataOnly? })` resolves either surface in the named
chat. The stream starts with `metadata`, then yields original bytes and cumulative
`bytesRead` / `byteLength`. A missing or deleted file returns an empty stream.
Metadata-only reads never open blob storage; destroying the stream cancels an
outstanding remote read. Assistant file staging uses this same endpoint.

Processor outputs reuse the existing artifact operation. Inline outputs are capped
at 512 KiB and carried inside the reference string, alongside a zero-length legacy
blob range. Their processor version has no RAG model separator, so released RAG
readers skip them. Inline data never enters blob storage or reclamation. The
compatibility suite runs released apply and reclaim code, including late joins,
reopen and downgrade, without changing mesh or local database schemas.

New image uploads opt into the `preview` processor. It produces an upright JPEG
from the first frame, at most 768 pixels on either side, targeting 80 KiB with
the 512 KiB inline ceiling. The uploader gets the first 30 seconds to produce it;
another capable peer can then recover missing work. Images uploaded before this
feature remain `not-applicable` and use their existing rendering path.

`filePreview({ chatId, fileId })` returns the preview's `outputId`, MIME type and
bytes, or an empty result while it is unavailable. It never downloads the original.
`fileRetry({ chatId, fileId, processorId })` clears local failure and retry state
for that processor. Desktop and mobile consume the same runtime file-status actor;
opening or saving an image requests its original separately. A failed preview has
retry and open-original actions.

Preview identity hashes the document ID, its immutable source core/range and the
processor version. Unlike RAG's source-byte hash, that source address lets a peer
recognize the matching preview without downloading the original. The version is
stored in the existing `embedderVersion` string as `processor:preview:1`, with zero
dimensions. Released devices ignore this output and continue reading originals;
no roster gate or forced update is needed for this compatible representation.

HTTP blob links probe the first requested block with a 15-second bound before
returning success headers. Missing blocks produce a transient HTTP failure; the
same URL can succeed after replication. HEAD and empty responses need no probe,
and byte ranges fetch only the requested range. Suspend and close cancel pending
probes. A deadline for stalls later in the response body remains follow-up work.

Progress is local to the uploading or processing device. Remote processing exposes
its existing replicated claim and result without invented counts. `claimedBy` is
the writer key; `agentId` is included when the current agent host matches it.
`published` means an output record exists, while `readyForChat` requires the local
RAG index to be loaded. Neither field promises that another device is ready.

Uploads fail after 30 seconds without an incoming frame. Cancelling releases their
writer and removes uncommitted bytes. Committed files survive cancellation that
arrives after publication. Suspend cancels outstanding source/output reads; resume
and peer connection allow recovery. An unavailable output can be rebuilt into the
local index when its source and embedding model are available, without changing
the immutable shared artifact reference. This local cache is rebuilt after restart.

`Files` owns the status consumed by both this watch and retrieval. `ragSearch`
includes `pendingFiles`, also surfaced in the prompt and source notice. Existing
knowledge and indexing APIs remain supported. `listIndexing` and `indexingWatch`
also report repeated source misses and locally unavailable outputs using the
existing response shape. These diagnostics never write shared status rows and
clear when the file becomes usable locally. This feature adds no replicated file
fields, operations, data migrations, or changes to existing RAG artifact IDs.

The TUI uses this watch for its live progress strip. `/files` lists the current
snapshot, including failures and whether each file is ready for chat on this
device. Upload with `/attach <path>` or `/knowledge add <path>`; `/knowledge`
retains its detailed indexing records for diagnostics.

## Watch streams: subscribe, unsubscribe, errors

Every `*Watch` capability (`chunksWatch`, `agentsWatch`, `devicesWatch`,
`configWatch`, `meshStatusWatch`) returns the same kind of stream, with one
contract:

- **The first frame is the current snapshot, immediately.** Subscribing IS
  the fetch — there is no fetch-then-subscribe race to paper over, ever.
- **Later frames arrive only on real change** (identical snapshots are
  deduped server-side), and each frame is the full current result, not a
  delta. The one exception says so in its name: `chunksDeltaWatch` sends a
  `reset` first and the changed rows after it, and its reset is still the
  snapshot.
- **`destroy()` is the unsubscribe** (ending a `for await` does the same
  thing). Nothing else to call, no registry to clean up — in any process,
  over any transport.
- **A dying stream can never crash the host.** Every stream comes pre-armed
  with an error observer, so a consumer that only listens to `'data'` is
  safe; `'close'` always fires, and a `for await` rejects with the reason.

The stream is typed end to end (`WatchStream<T>` — async-iterable AND
evented; `T` is the hyperschema frame type), so both idioms typecheck:

**Loop** — `break`/`return` unsubscribes:

```js
for await (const { agents } of engine.agentsWatch({ meshId })) {
  render(agents)
  if (done) break // break IS the unsubscribe
}
```

**Mount/unmount** — subscribe with `on('data')`, unsubscribe with
`destroy()`; this is plain streamx, nothing layered on top:

```js
const stream = engine.chunksWatch({ meshId, chatId }) // opening the chat
stream.on('data', ({ chunks }) => render(chunks))
// ...closing the chat:
stream.destroy() // the unsubscribe
```

**One value, not a stream** — take the first frame and leave; still no
race, because frame one is the snapshot:

```js
async function once(stream) {
  for await (const frame of stream) return frame // break-on-return unsubscribes
}
const { devices } = await once(engine.devicesWatch({ meshId }))
```

**Errors end the stream, they never hang it.** A server-side query failure
destroys the stream with that error (`for await` rejects with it); transport
death settles every open stream and pending call. So a long-lived consumer
is a re-arm loop, not error plumbing:

```js
while (!closing) {
  try {
    for await (const { chunks } of engine.chunksWatch({ meshId, chatId })) render(chunks)
    break // server ended the stream deliberately
  } catch {
    await delay(1000) // transport blip — resubscribe (frame one re-syncs you)
  }
}
```

Under the hood: ending the iterator destroys the wire stream, a DESTROY
frame crosses the transport, and the Core releases the underlying store
watcher — verified by test. The relays a host puts between the Client and
the Core (Electron IPC, a worklet bridge) carry these as ordinary bytes and
hold no subscription state, so there is nothing to unsubscribe at any layer
in between. If several consumers want the same data, share ONE subscription
and ref-count the unsubscribe in your app layer — the stream is cheap, but
one per consumer is still one store watcher each on the Core.

## Harness event reference

`completion()` may yield:

| event         | shape                                  | becomes                                                   |
| ------------- | -------------------------------------- | --------------------------------------------------------- |
| `content`     | `{ type, text }`                       | `content` chunks (coalesced)                              |
| `thinking`    | `{ type, text }`                       | `thinking` chunks                                         |
| `tool-call`   | `{ type, name, args }`                 | `tool-call` chunk (`toolCall.name`, `toolCall.arguments`) |
| `tool-result` | `{ type, name, result }`               | `tool-result` chunk (`toolResult`)                        |
| `metrics`     | `{ type, totalTokens, durationMs, … }` | stored on the completed run-status                        |
| `error`       | `{ type, message }`                    | run-status `failed`                                       |
| `aborted`     | `{ type }`                             | run-status `canceled`                                     |

Context you receive: `model` (the agent's model name), `agent`
(`{ name, bio }`), `messages` (`{ role, content }[]`), `approve(call)`,
`signal`.

## Connecting a skill (Notion, GitHub, …)

A skill reaches an external service through a **credential key** its
`SKILL.md` declares. The harness never sees the raw token: the credential
store resolves the key at call time and injects it as a bearer, and the
skill's `allow_list` binds that key to the URL prefixes it may be sent to.
Credentials are **per agent** (stored at `skills.<agentId>.<key>`), so two
agents never share one connection.

A host fills a key: `@qvac/core/oauth` runs the browser OAuth flow for Google,
Spotify, Asana and Notion, stores the token and refreshes it on use, and
`@qvac/core/credential-pusher` keeps the harness's copy current.

Google and Asana need the host's own client id and secret (for Asana, an
MCP-type app registered at app.asana.com), Spotify a client id; Notion needs
nothing — its MCP server self-provisions a public client via dynamic
registration (RFC 7591) + PKCE.

### Notion

Notion runs over its official MCP server (`https://mcp.notion.com/mcp`) via
the `mcp_call` tool, under the credential key `notion_mcp_access_token`. Once the agent holds the token, and has the `notion` skill when its skill scope
is `selected`, ask the assistant anything Notion — it loads the skill and calls
`mcp_call` itself; the session handshake and auth are handled for you. A `401`
in a tool result means the token expired — connect Notion again.

## Development

```sh
npm test               # node + bare suites
npm run build:schema   # regenerate spec/ from schema/ (bare)
```

Schema changes go in `schema/*.ts` (builders) — `spec/` is generated. The
mesh schema (`spec/mesh/*`) is the replicated protocol: every device in a
mesh must run the same generated spec. See `MIGRATION.md` for the audited
feature checklist vs core v1.

### Office documents

Core ships no office decoder. Office documents (`.docx`, `.xlsx`, `.pptx`,
`.odt`, …) index only when the host passes one through the `extractors.office`
option — the desktop app injects `extractOfficeText` from
`@qvac/harness/office`. A host without one, such as mobile, fails those files
as `extractor unavailable on this device`. Everything else — `.pdf`, `.txt`,
`.md`, `.rtf`, `.html`, `.csv`, `.json` and the rest — works from any install.
