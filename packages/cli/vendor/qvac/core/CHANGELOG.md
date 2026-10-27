# Changelog

All notable changes to `@qvac/core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the major version is `0`, a breaking change bumps the minor version.

Route by route detail, with what a caller has to do differently, is in each
module's changelog under [`docs/api/`](docs/api/README.md). The examples below
call the routes on a `Client`, named `engine`, in the shape they had in that
release.

## [Unreleased]

### Added

- `@qvac/core/sidecar-entry` names the script a host spawns as Core's sidecar, so a host
  resolves it by name instead of a path into the package. `test/basic/entry-weight.ts` holds
  every named entry to a ceiling on the files importing it loads, so an app that imports a
  constant never parses the engine.

- After a completed run, on a host that asks for it, the assistant suggests the user's likely next message
  and stores it on the chat, so a client can offer it to accept with one key:

  ```js
  const chat = await engine.getChat({ meshId, chatId })
  if (chat.suggestion?.runId === latestRunId) offer(chat.suggestion.text)
  ```

  It is one short tool-less call after the title, cancelled by the chat's next
  run, and off until the model host sets the device config key
  `assistant.suggestPrompts` to `on`.
  ([chat.md](docs/api/chat.md#setchatsuggestion))

- A message sent while the chat's run is still going steers it: the model host
  hands it to that run, which takes it at its next tool call and answers it there,
  instead of queueing a separate run behind it. Its own run then ends at once:

  ```js
  // { state: 'completed', reason: 'steered', metrics: { steeredInto: runId } }
  ```

  A run that never takes it leaves the message its own run, as before, and a
  harness without steering ignores the offer.
  ([execution.md](docs/api/execution.md#sendmessage))

- `worker/assistant-sidecar.mjs` takes `autoDownloadModels` from the host and
  passes it to `Core`. Unset keeps today's behaviour; `false` starts a host
  without fetching the default models. A sidecar that fails to start also writes
  the reason to stderr, since the host may not be listening yet.

### Changed

- Core depends on `@qvac/harness` 1.0.0-rc.8 from npm instead of a git commit, so a consumer installs
  the published harness with its named entries.

- The baked version floor is `>=0.21.0`: one build per mesh, since v0.21 changes
  what apply admits. Each mesh now holds a rules row, `@qvac/mesh-rules`, first
  in a new mesh's genesis and appended once when this build first holds an
  existing mesh writable, and apply holds new rules to ops after it only. A
  0.7.x replica that applies the row halts into its update prompt.

  **Operator step:** publish `>=0.21.0` with `qvac-app → scripts/ota-config.mjs`
  on each lane (dev, staging, prod) only once app 0.21 is live on that lane, and
  never before: a floor above the installed release withholds every device on
  the lane. Until it is published, an old replica that fast-forwards past the row
  applies later ops under the old rules.

- A rules row raised above the rules this build knows halts apply into its
  update prompt with the code `MESH_RULES_FROM_A_NEWER_BUILD`, instead of being
  applied.

### Removed

- The `duck` terminal UI and its bin; the terminal app lives in its own repo.

### Fixed

- A resume whose announce reached no DHT node retries that topic within
  seconds, instead of leaving the device unfindable for ten minutes.

## [0.11.0] - 2026-10-23

### Added

- `OAuthFlowDeps.onStage` reports `awaiting-callback` and `exchanging-code`, so a
  host can log where a connect flow stopped. (#550)
- `deliverOAuthCallback(address)` in `@qvac/core/oauth` settles a waiting
  sign-in from a callback address the user pastes, for a browser that cannot
  reach the loopback. (#551)

### Changed

- The OAuth loopback done page tells the user to return to QV.AC to finish
  connecting. (#550)
- The PDF page-image cap scales with the run's context window, between 2 and
  32 pages, instead of a fixed 10. (#526)

### Fixed

- An OAuth connect whose provider stops answering now fails after 30 s instead
  of waiting forever: the code exchange after the browser hands back the code
  with `OAUTH_TOKEN_EXCHANGE_TIMEOUT`, and dynamic client registration, before
  the browser opens, with `OAUTH_REGISTRATION_TIMEOUT`.
  `OAuthFlowDeps.requestTimeoutMs` sets the limit per request. (#555)
- A PDF cut at the page-image cap tells the model the last page shown. (#525)
- Each user turn renders the same bytes on every request, so the chat's KV
  cache is reused. (#528)
- Two devices that take turns to leave the account and pair back can both still
  `meshInvite`. Before, the fourth pairing left a device refused with
  `DEVICE_INVITE_CHAIN_TOO_LONG`. (#513)
- `joinMesh` no longer hangs when a device pairs back right after it unpaired,
  while the removal its leave left behind is still being delivered. (#513)

## [0.10.4] - 2026-10-22

### Added

- A video attachment reaches the chat's model as up to 32 frames, sized to the
  context window, with their times and a transcript of its audio track. The
  first run stores them as an attachment chunk carrying `sourceId`, the video's
  attachment id, which later turns and other devices read instead of the video;
  an app should not render a chunk with `sourceId`. `uploadAttachment` takes
  `sourceId` on its first frame. Core now depends on `bare-ffmpeg`. See
  [attachments](docs/api/attachments.md) and [chunks](docs/api/chunks.md).
  (#496)
- A `ctxSize`, `kvCacheK` or `kvCacheV` change reloads the agent's model on its
  host 2.5 seconds after the last edit, if it is loaded, instead of on the
  agent's next message. (#495)

### Changed

- `fileStatusWatch` reads only the chat's attachments, not every message in the
  chat, on each refresh. (#518)

### Fixed

- A device that unpairs itself hands the agents it hosted to its member's
  earliest-paired live device, in the account and every shared mesh, instead of
  leaving them orphaned. A leave from an earlier release is handed over on the
  next boot. (#514)
- On a harness in its own process, an image sent to a model without a projector
  is no longer dropped silently: the run asks the harness about the chat's
  model, and the turn says the image is not visible to it. (#494)
- A token saved for an agent reaches `skills` and `skillCatalog` readiness as
  soon as it is written, instead of after the ten-minute credential refresh.
  (#523)
- `duck` reopens the meshes it had saved when it starts. (#519)

## [0.10.3] - 2026-10-21

### Added

- `listAgentFolders`, `addAgentFolder` and `removeAgentFolder` share a folder on
  this device with an agent, read only or read and write, so its file tools have
  somewhere to work. They keep the `fs.<agentId>.roots` and
  `fs.<agentId>.writable` config keys the assistant already reads, so a grant
  written before keeps working. See
  [agent folders](docs/api/agent-folders.md). (#445)

### Changed

- The runs a `deleteAgent` with `keepChats` cancels carry
  `reason: 'agent-deleted'`, so an app can tell them from a run its user took
  back and keep the message they answered. (#486)
- `deleteAgent` forgets the folders shared with the agent on this device. (#445)

### Fixed

- A borrowed run (`lenderDeviceId`) no longer acts on the lender's machine. The
  lender serves it with no shared folders, with the `files` and `exec` toolsets
  off, as none of its own agents, and with its KV caches kept apart; a borrowed
  run gets no image or attachment. (#477)
- A device-invite `joinMesh` no longer lists a mesh it is leaving as closed, so
  the app no longer reopens it and reports `MESH_NOT_FOUND` after pairing.
  (#489)

## [0.10.2] - 2026-10-20

### Added

- `deleteAgent` takes `keepChats`, so an app can take an agent off a space
  without deleting the conversations it answered there. They stay readable, and
  `setChatAgent` hands each to another agent. The agent's open runs in them are
  canceled. (`AssistantDeleteAgentRequest`) (#469)

### Changed

- `sendMessage` and `runAgent` refuse an agent that is deleted with
  `AGENT_NOT_FOUND` instead of writing a run no device would claim. (#469)

### Fixed

- A device that pairs onto another account no longer lists its old workspace
  beside the new one. An `openMesh` sent during the pair waits for it and is
  refused with `MESH_NOT_FOUND` for a workspace the pair left. (#482)
- A device that pairs onto another account no longer renames that account's user
  to the name it had before; it takes the account's name. (#475)
- An edited or reverted skill reaches chats that had already loaded it. A
  skill write or delete clears the hosting device's KV caches and run replay
  records, so each chat's next turn reloads the skill from disk; that turn
  prefills cold (QVAC-26561). (#473)
- `duck`: `/models add` keeps a vision model's projector, so its images are no
  longer dropped. (#480)
- `duck`: `/models use <name>` refuses a name that is neither an added model's
  label or id nor an exact catalog or registry name, instead of setting it and
  letting the harness load whatever file the registry search hit first, which
  could be a vision projector. A path or URL is still set as given. (#481)

## [0.10.1] - 2026-10-19

### Added

- `QvacAssistant` takes `runIdleTimeoutMs`, how long a run's harness may send
  nothing before the run fails. It defaults to 15 minutes. (#468)

### Changed

- `@qvac/harness` is now `^0.8.11` and `@qvac/skills` `^0.1.16`. (#468)

### Fixed

- A run whose harness goes silent fails with "the agent stopped responding"
  instead of showing busy forever. A run parked on an approval does not count
  as silent. (#468)

## [0.10.0] - 2026-10-16

### Added

- Core's refusals carry a registered `@qvac/error` code, so a caller matches
  them with `isCoreError` from `@qvac/core/errors` instead of their message,
  which is unchanged. Every route family has its codes (`CHAT_*`, `MESH_*`,
  `INVITE_*`, `MEMBER_*`, `DEVICE_*`, `AGENT_*`, `UPLOAD_*`, `MODEL_*`, `OAUTH_*`
  and the rest, exported from `@qvac/core/errors`), and a refusal from a hosting device reaches the caller with
  its code. An older host sends none, so its refusal arrives as its message
  alone. Each module's codes are in its file under
  [`docs/api/`](docs/api/README.md). (#382, #383, #384, #385, #386, #387, #388)
- `Logger` from `@qvac/core/log` implements `@qvac/logging`'s
  `LoggerInterface`, has `getLevel()`, and takes `logLevel: 'off'`. `Client`,
  `QvacAssistant`, the assistant children and the model pushers take any
  `LoggerInterface`, so a `QvacLogger` can be passed. (#389)
- `duck` indexes office attachments with the harness extractor. (#457)

### Changed

- **Breaking:** each `Core` writes only to the logger it is given, and one
  created without a `logger` writes nothing, where it used to fall back to the
  process-wide logger. Pass the logger to `Core`, `Client` and `QvacAssistant`.
  (#389)
- `logSimilarityScores` from `@qvac/core/rag/similarity` writes only to the
  logger passed as its third argument. (#389)

  ```js
  logSimilarityScores(candidates, kept) // 0.9
  logSimilarityScores(candidates, kept, logger) // 0.10
  ```

- **Breaking:** a compute mesh's dropped write is named
  `COMPUTE_ROUTE_DROPPED`, where it was `ComputeRouteDropped`, and has no
  `route` field. Match it by code. (#382)

  ```js
  err.name === 'ComputeRouteDropped' // 0.9
  isCoreError(err, 'COMPUTE_ROUTE_DROPPED') // 0.10
  ```

### Removed

- **Breaking:** `setLogger` and the `globalThis.logger` it set. (#389)

  ```js
  setLogger(logger) // 0.9, then new Core(options)
  new Core({ ...options, logger }) // 0.10
  ```

- **Breaking:** `LEVELS` from `@qvac/core/log`. Use `LEVEL_PRIORITIES` from
  `@qvac/logging/constants`, which ranks the other way round: `error` is 0.
  (#389)

  ```js
  LEVELS[level] >= LEVELS.warn // 0.9
  LEVEL_PRIORITIES[level] <= LEVEL_PRIORITIES.warn // 0.10
  ```

### Fixed

- An office file the agent host cannot decode reads `failed` with
  `extractor unavailable on this device` in `fileStatusWatch`, and `ragSearch`
  lists it in `failedFiles`, instead of staying pending forever and holding up
  the run waiting on it. (#456)
- `updateMember` or `removeMember` called right after a join no longer fails
  with `this device is in no member of its account`; it waits for the join to
  land. (#391)
- A device that fast-forwards back onto a mesh lands without reading the view
  in the update hook, as a joiner does. It used to scan every device, chat and
  purged chat first. Chats deleted while it was away are found by the chat
  order rebuild, purges by the device's own file index, and its own kick by
  its own device row. (#465)
- A fast-forward no longer downloads every version of the view, and the
  move-to sweep reads attachments only in the chats this device holds files
  for, and knowledge rows whole, not every chat and attachment in the mesh. (#465)
- A linear update reads at most one old row per change. A revoked device or a
  re-homed chat no longer scans every agent or a chat's whole history to find
  its files, and the membership tally runs after the update instead of inside
  it. (#465)
- A joiner no longer walks every chunk of the mesh it joined to backfill its
  file index, and the backfill, the orphan sweep at every open and the purged
  file reclaim read attachments chat by chat off an index instead of every
  message. (#465)
- The view update hook only queues the update. A background pass syncs what
  the device derives from the view, and folds updates that land while it runs
  into one diff, so a streamed reply or a catch-up no longer walks once per
  append, and the drain never waits on a peer for a block a side effect reads. (#465)
- The oldest view head a device has not synced is kept in the device-local
  `@local/mesh-updates`, so a pass a close or crash cuts short resumes on the
  next open instead of losing what it would have raised. (#465)

## [0.9.0] - 2026-10-15

### Changed

- **Breaking:** `meshInvite` mints a member invite as `qvac://workspace/…` and
  a device invite as `qvac://device/…`, instead of `qvac://mesh/…`
  (QVAC-26926). `joinMesh`, `previewMeshInvite` and `decodeMeshInvite` read all
  three, so a link shared before still works, but a release before this one
  refuses the new links with `Invalid mesh invite`: both sides of a join need
  this version. An app that matches the prefix itself has to accept all three
  before it takes this release, as tetherto/qvac-app#2535 does. (#394)

  ```js
  const { invite } = await engine.meshInvite({ meshId, member: true })
  // 0.8: qvac://mesh/…   0.9: qvac://workspace/…
  const { invite: pairing } = await engine.meshInvite({})
  // 0.8: qvac://mesh/…   0.9: qvac://device/…
  ```

## [0.8.0] - 2026-10-15

### Added

- `skillCatalog` entries carry `displayName`, the user-facing name and `@`
  handle a skill's manifest declares, so an app can show Documents and
  Spreadsheets for the `word` and `excel` skills without renaming them. (#392)

  ```js
  const { skills } = await engine.skillCatalog({ agentId: agent.id })
  const handle = skills.map((skill) => skill.displayName ?? skill.name)
  ```

- `meshStatusWatch` frames carry `blindPeersConnected` and `blindPeersTotal`,
  the device's blind peers holding a connection of those it dials; a blind
  peer connecting or dropping makes a frame. (#403)
- Every mesh lifecycle line carries where the mesh stood: `opening` names the
  head it boots from (`null` is a replay from genesis), `autobee opened`,
  `landed on the view`, `joined` and `closing` carry the local, system and
  view lengths, the flushes, autobee's counters and the time since the open;
  Core logs `mesh opened` with why (`route`, `follow`, `readmit`) and how long,
  `followed the joined meshes` with its tally, and names the mesh it announces.
  `diagnostics` returns the same counters under `stats.mesh.stats`. The two
  seed lines (`seeded default agent`, `seeded first chat`) are debug: a rebuilt
  view re-applies the genesis seed, and they read as a second seeding. (#403)

### Changed

- Joining a mesh reports joined as soon as the fast-forward lands, instead of
  after a read of the whole view over the network. On a mesh with a long
  history that read took tens of seconds, whatever the invite's head. The
  member tally, mesh name, chat order and file index fill in moments after the
  landing; a chat list in that window waits for the rebuild. (#400)
- The mesh logs `landed on the view` and `joined` with their timings, applies
  and undos, and `device admitted` is a debug line: a catch-up re-applies every
  claim on each re-linearisation. (#400)
- The meshes an account names open once the account's own join has settled,
  instead of the moment the account lands, so they no longer compete with the
  account's catch-up for the same peers. (#407)

### Fixed

- A mesh the account names on a sibling's behalf, opened with no head of its
  own, fast-forwards onto the first head a sibling device offers, instead of
  replaying from genesis until that device's row happened to land. The head's
  own view carries the device's signed claim to the writer, and the account
  says whose device that is. (#408)
- One blind-peering client per device, shared by every mesh and core. Each mesh
  (and the config, recovery, departure and drive cores) built its own client,
  all dialling under the device's one key, and a blind peer keeps one connection
  per key: every connect by one mesh dropped another's, endlessly. A mesh's
  invite still names the blind peers it is mirrored on; what is shared is the
  connection to each. (#405)
- A device no longer dials every device in its account mesh directly on each
  membership change; peers are found on the mesh topic. (#405)
- A device coming back after a long absence fast-forwards onto the new head
  without diffing the whole view across cores: it reads the landed snapshot,
  and the attachments deleted while it was away refresh on the sweep. On a mesh
  with ~20k rows that jump took 110–150 s; it now takes a few seconds. (#399,
  #402)

## [0.7.6] - 2026-10-14

### Added

- `duck`: `/tools` (and Menu ▸ Agent ▸ Tools) is back as the toolset switches, each
  listing the tools it gates, read from the device the agent runs on. `/permissions`
  keeps only the approval mode. (#380)

### Fixed

- `duck`: copying (ctrl+y, or a drag selection) works with no clipboard command, in
  a container or over ssh. It asks the terminal to set the clipboard with OSC 52,
  which the terminal has to allow, and `xsel` is tried after `wl-copy` and
  `xclip`. (#395)

## [0.7.5] - 2026-10-13

### Fixed

- A reply cut off by a phone lock now restarts on unlock instead of ending as
  failed (QVAC-24690). Between `presuspend` and `suspend` iOS refuses GPU work,
  so the harness ends the turn with an error event or an abort of its own.
  While the assistant is in the background that ending now replays the run
  under the same `runId`, for chat and capability runs alike, and a run that
  arrives in that window waits. A `resume` from `presuspend` starts both again.
  A thrown error still fails the run, and a context overflow reported during
  that window folds after the resume instead. (#368)

## [0.7.4] - 2026-10-13

### Added

- A mesh write still pending after five seconds, or a mesh's first drain
  still pending after fifteen, logs a warning once: the ops a write carries,
  the drain's counters, and every core the views read through that this device
  holds only in part, with how many peers could serve it, and which blind peers
  it has reached. Writes queued behind
  the same stall do not repeat it, and it logs again when the stall settles or
  the write fails. A drain parked on data no connected peer holds used to say
  nothing, so a hung send, stop, delete or leave left no trace in an exported
  log.
- Leaving a mesh logs when it starts, so an exported log shows the attempt even
  when the leave never finishes. (#352)

- Model routes reach another device of this account (QVAC-25101). `listModels`,
  `modelsWatch`, `loadModel`, `unloadModel`, `deleteModel`, `retryModelDownload`,
  `clearModelDownload`, `modelUsers`, the custom-model routes and the model
  watches take an optional `deviceId`, and Core runs the call on that device over
  the `qvac/device-control` peer channel, so fit, memory, disk and the download
  queue are that device's. Only a live device of this account's own member is
  served, and a custom model added from another device must come from a link.
  While the device is away a call rejects with `the device is not reachable`;
  `meshStatusWatch`'s `peerDeviceIds` says when it is connected again. (#280)

  ```js
  await engine.loadModel({ name: 'Qwen3.5-9B-Q4_K_M', deviceId: desktop.id })
  ```

- A phone changes a paired desktop's own model settings and pauses its
  downloads. `configGet`, `configSet` and `configWatch` take an optional
  `deviceId` and reach `model.idleUnloadMinutes` and `model.memoryCapPercent` on
  that device; any other key is refused there, since the same store holds
  integration tokens. `setModelPaused` takes `deviceId` too, so a download on the
  desktop pauses there rather than on the phone, until the desktop restarts. (#359)

  ```js
  import { MODEL_MEMORY_CAP_KEY } from '@qvac/core/constants'

  await engine.configSet({ key: MODEL_MEMORY_CAP_KEY, value: 60, deviceId: desktop.id })
  await engine.setModelPaused({ name: 'Qwen3.5-9B-Q4_K_M', paused: true, deviceId: desktop.id })
  ```

- `duck`: `/device use <n|name>` points every `/models` command at another
  device of this account, and `/device list` shows each one, whether it is
  connected and how many models it has downloaded. `/models idle`,
  `/models cap` and `/models settings` set and show a device's idle limit and
  memory cap, and `/models pause` / `/models resume` hold a download. (#360)

### Changed

- `loadModel`, `unloadModel`, `deleteModel`, `modelUsers`,
  `clearModelDownload`, `retryModelDownload` and `removeCustomModel` had a
  request of `name` alone; its new optional `deviceId` adds a flags byte, so
  this Core cannot decode those calls from a `Client` of an earlier release
  (`Out of bounds`). Upgrade the `Client` with the Core.
- `configGet`, `configWatch` and `configSet` gain the same flags byte with
  their optional `deviceId`, so this Core cannot decode them from a `Client` of
  an earlier release either. (#280, #359)
- `duck --join <invite>` now takes only a member invite, and the new `duck --device-join <invite>` takes only a device invite; each refuses the other's and names the right flag. `/join` previews say whether the current mesh is retired, and `/invite` says how the invitee joins. `/meshes` tags the account mesh as `home (your account)` and its footer says how to name a mesh. (#377)

### Fixed

- Suspending no longer logs every watch it closes as `watch failed` with a
  bare `Stream was destroyed`. The assistant ended those streams itself, so
  none of them failed.
- A log line that carries an error in its details, such as
  `{ op, err }`, prints the error's stack instead of `{}`. A destroyed stream's
  error records the code that destroyed it, so the log now says why it ended.
- A device lending its compute no longer crashes when the borrower drops a call
  while the lender is still accepting it. Before, the dropped stream's error
  went unhandled and took the lender's whole process down. (#355)
- `updateAgent` and `deleteAgent` stamp their write after the row it replaces,
  so an edit or a delete made on a device whose clock runs behind the last
  writer's is applied instead of dropped as stale. A dropped delete had still
  deleted the agent's chats. (#358)
- `duck` started with a device invite no longer fails with
  `This device cannot reach its account to check`. It asked for its own invite
  while the join was still under way; it now waits for the join to finish.

## [0.7.3] - 2026-10-13

### Changed

- `MAX_AUDIO_ATTACHMENT_BYTES` (`@qvac/core/audio-format`) rises from 25 MiB to 100 MiB, matching `MAX_ATTACHMENT_BYTES`, so a client no longer refuses audio the mesh accepts. (#375)

## [0.7.2] - 2026-10-13

### Added

- `duck --join <invite>` (`-j`) joins a mesh invite at boot, so a `--headless` peer, which has no prompt to `/join` from, can get onto an existing mesh. A device invite pairs it into your account; a member invite adds a shared mesh to its own. (#371)

  ```sh
  duck --headless --storage ~/duck-data --join qvac://mesh/…
  ```

- `/rename device <name>` names this device and `/rename member <name>` names you in every mesh at once, so a roster of `duck-<pid>` devices can be told apart. (#372)

## [0.7.1] - 2026-10-12

### Added

- `forkChat` copies a chat into a new one, through a turn or just before it, in
  the same mesh or another (QVAC-26722). The source stays as it was, the fork
  lands on top of its list with ids of its own, and `AssistantChat` names where
  it came from in `forkedFrom`. Its files are its own copies, so removing one
  in either chat leaves the other's, and into another mesh it needs one of that
  mesh's agents. (#346)

  ```js
  const fork = await engine.forkChat({ meshId, chatId, runId: reply.runId })
  ```

- `setBlindPeering` and `blindPeeringWatch` turn every blind peering on this
  device off or back on, kept across restarts, for reproducing sync with no
  mirror in the middle. `diagnostics` reports it as `stats.mesh.blindPeering`,
  and a `recoveryPublish` made while it is off does not mark the account
  recoverable. (#334)

  ```js
  await engine.setBlindPeering({ enabled: false })
  ```

### Changed

- `@qvac/harness` is `^0.8.7` and `@qvac/skills` 0.1.14, which bring the
  `browser` skill. Every run now hands the harness its chat as `session`, with
  or without a cache key, so a skill whose manifest declares
  `${session}` in its `env` keeps one resource per chat, such as the browser
  the `browser` skill drives. (#369)
- `createAgent` and `updateAgent` ignore `toolsScope` and `enabledTools` and
  always store `toolsScope: 'all'`, leaving `disabledToolsets` as the only
  per-agent gate on tools. Each mesh rewrites its stored `selected` agents to
  `all` once on open, so an agent saved with an empty list runs with its tools
  again. (#363)

### Fixed

- The harness is handed the turn as typed, so a skill mention or a search ask
  is read from what the user wrote, not from attached documents, knowledge or
  sender lines wrapped around it (QVAC-24963). Before,
  `@pdf Summarize these docs` with a PDF attached could load
  `image-generation`, and a document saying "search the web" went out as the
  search query. (#347)
- The model downloader picks the text-to-speech model for the profile the
  hardware probe found, the same one speaking asks for (QVAC-25679). Before, a
  new device could plan its downloads while its row still held the host's seed
  profile and keep that for the session, so a "mid" or higher device fetched
  `Supertonic3-Q4_0` while read aloud waited for `Supertonic3-FP16` and stayed
  disabled until a restart. If the probe fails, it plans for "low", the voice
  the harness then speaks with. (#367)
- A device dials the other devices of its account by key as well as finding
  them on the mesh topic, and dials them again on resume. Before, a topic
  refresh that missed after a suspend or a network change left a phone without
  its Mac for ten minutes or more, so a chat with an agent the Mac hosted sat
  on "waiting to reconnect" though both were online. (#327)
- `removeDevice` on a device of our own member moves the agents it hosted to
  the device that removed it, in that mesh and, for a removal from the account,
  in every shared mesh of ours it is revoked in, so a run waiting on the removed
  device runs there; a removal made on an earlier build is caught up on the
  next boot. Before, the agents stayed orphaned and the chat waited forever.
  (#327)

## [0.7.0] - 2026-10-09

### Added

- Model downloads can wait to be asked for, so a phone on cellular does not
  fetch gigabytes on its own. Pass `autoDownloadModels: false` to the Core
  constructor so it holds from the first boot, or toggle it later. A run that
  needs a missing model then waits as `awaiting-download` instead of fetching it,
  and so do image, music, transcription, speech and embedding loads in the
  harness (#332, #333):

  ```js
  await engine.setAutoDownloadModels({ enabled: false })
  for await (const { downloads } of engine.modelDownloadsWatch({})) {
    const held = (downloads ?? []).find((row) => row.phase === 'held')
    if (held) {
      await engine.retryModelDownload({ name: held.name })
      break
    }
  }
  ```

- The OAuth loopback serves callbacks under Bare too, so a mobile worklet can
  complete sign-in on the same `127.0.0.1` redirect desktop registers. (#329)
- `openOAuthLoopback` takes an optional `returnTo`: the callback redirects the
  browser there instead of showing the done page. (#329)
- Several models stay loaded when memory allows (QVAC-25735). On desktop the
  assistant pushes `model.memoryCapPercent` to the harness: loaded models may
  fill that share of the memory usable for models, 85% by default, so two chat
  models that fit stay loaded and switching chats between them loads neither
  again. A load that would not fit unloads idle models one at a time, other
  kinds before chat models and the least recently used first. It applies with
  no restart; the minimum keeps one chat model loaded, and a mobile device
  always does. `listModels` and `modelsWatch` carry the device's `memory`
  (`usableBytes`, `capPercent`, `capBytes`, `usedBytes`, and `overCap` when a
  model larger than the cap loaded anyway) and each loaded row its
  `memoryBytes`, so a Models screen shows used against the cap. Needs the
  `@qvac/harness` release with `setModelMemoryCap` and `memoryUsage`; an older
  one keeps one chat model loaded and lists no `memory`. (#343)

  ```js
  import { MODEL_MEMORY_CAP_KEY } from '@qvac/core/constants'

  await engine.configSet({ key: MODEL_MEMORY_CAP_KEY, value: 70 })
  const { memory } = await engine.listModels({ cachedOnly: true })
  ```

- A device pairs and follows its member with no other device online. A device
  invite carries a keypair attested into the inviter's member, so the joiner
  links itself, and the account holds every shared mesh's seed (the new
  `@qvac/put-mesh-seed` route), so a new device opens them all from a blind
  peer alone. A device invite minted by 0.6.6 still admits a device but no
  longer links it into the member. `meshInvite` refuses a device invite from a
  device whose proof chain is too long to extend, naming another device or the
  phrase instead. (#342)
- `diagnostics` carries `backendUse`: per tool, the backends its recent runs
  on this device reported, newest last. A run that asked for the gpu and ran
  on the cpu is the fallback to look for. (#22)

  ```js
  const { stats } = await engine.diagnostics({})
  stats.backendUse.generate_music.at(-1)
  // { requestedGpu: true, device: 'cpu', backend: 'cpu' }
  ```

- `duck`: `/doctor` checks this device (hardware, engine, model backends, mesh,
  network) and `/doctor debug` shows the raw diagnostics frame behind it.
  `ctrl+y` copies either as plain text, with the mesh seed and any invite
  redacted and keys truncated. (#22)

### Changed

- An invite is a password again, as it was before 0.5.0. A member invite mints
  no grant and a device invite no expiring token: either link is the mesh
  seed, reusable for good, and the joining device admits itself with the new
  `@qvac/open-join` route; `joinMesh` and `recoverAccount` return once the
  join is recorded, appending it in the background, with the account reporting
  `joining` until the mesh reaches it. A device invite pairs with the inviting
  device offline, and `recoverAccount` needs no other device online. A removed
  device comes back the next time it joins. Every route that shipped keeps its
  0.6.6 meaning, and a 0.6.6 or 0.6.7 replica halts on the new one, so this
  raises the floor to `>=0.19.1`. (#342)

  ```js
  const { invite } = await engine.meshInvite({ member: true })
  await engine.joinMesh({ invite }) // any number of times, by anyone holding it
  ```

- `joinMesh` and `recoverAccount` fail with "This device has no device
  details: pass `device` when creating Core" on a Core created without
  `device` and with none stored, and a `meshSeed` boot reports it as its
  status error: a mesh admits only a device it can list and remove. (#342)

- A mesh still `joining` refuses a write into it at once with "This mesh is
  still joining: it accepts writes once it is joined", since nothing written
  there reaches disk until a peer serves the mesh. Reads keep working; retry
  the write once the mesh lists `joined`. (#342)

- `listMeshes` and `meshesWatch` rows no longer set `reason` or
  `awaitingFrom`: no other device admits a joining one any more. Read
  `state: 'joining'` alone. (#342)

### Deprecated

- `meshEntry.reason` and `meshEntry.awaitingFrom`, which are never set. (#342)

### Removed

- The `grantWritableMs`, `grantVisibleMs` and `accountWritableMs` Core options.
  Nothing on a join, a mint or a logout waits for a mesh to go writable any
  more: a departure the mesh cannot take yet is revoked by the departures
  outbox once it can, and a mesh minted before the account can write is
  registered there once it can. (#342)

### Fixed

- A chat's KV cache no longer grows by duplicated history: each run is replayed
  to the model exactly as it was sent. (#338)
- A chat handed to another agent on the same device, by `setChatAgent` or a
  `sendMessage` naming another `agentId`, no longer leaves the old agent's KV
  cache file on disk until the chat is deleted. (#330)
- Reopening the account mesh after its local database died clears "the local
  database died" error once the reopened mesh is healthy. (#340)
- `duck`: `/agent new` gives the new agent a real model in a mesh with no agent
  yet, and `/agent use` hands the open chat to the agent it selects. (#348, #331)

## [0.6.7] - 2026-10-06

### Added

- A `quack` model for testing mesh, sync and chat flows without inference. An
  agent on it replies with `quack` repeated 1 to 500 times, counted from a hash
  of the last user turn, so the same prompt always gets the same reply. Every
  other model still runs on the real harness. The device-local
  `debug.fakeModels` key (`FAKE_MODELS_KEY` in `@qvac/core/constants`, beside the `QUACK_MODEL` name) turns it
  on and off live, which is what an app's Debug toggle writes. `assistantChild`
  and `assistantTree` take `fakeModels: true` to force it on, which is what duck
  does with its `--fake-models` flag or `QVAC_FAKE_MODELS=1`.

  ```js
  await engine.configSet({ key: FAKE_MODELS_KEY, value: true })
  ```

  ```sh
  QVAC_MODEL=quack duck --temp --fake-models
  ```

- `Core` accepts `store`, `swarm` and `wakeup`, so a host that is already a
  peer-to-peer application passes the ones it runs rather than having Core
  stand up a second of each. Core never closes, destroys or suspends what it
  was passed, takes the device identity from a passed swarm's keypair, and
  leaves replication and wakeup on a passed swarm to the host. `swarm`
  requires `store` and `wakeup`. The host suspends Core before its store, and
  resumes its store before resuming or closing Core. `storagePath` is
  unchanged and still holds the device-local database. See
  [the decision record](docs/decisions/2026-09-28-a-host-passes-core-its-corestore-and-swarm.md).

  ```js
  const core = new Core(transport, {
    storagePath,
    store: host.rootCorestore.namespace('qvac'),
    swarm: host.swarm,
    wakeup: host.wakeup
  })
  ```

  (#303)

### Changed

- `@qvac/skills` is pinned at 0.1.11. 0.1.12 grants the `pptx`, `docx`, `xlsx`
  and `transcribe_music` tools, which `@qvac/harness` does not register yet, so
  a range would let a fresh install read presentations, word and excel as
  unsupported. (#321)

### Fixed

- The assistant reports readiness for an agent newly hosted in the account as
  soon as it lands there, as it already did in a shared mesh, so a credential
  handed off to an agent created from another device no longer waits on it.
  (#320)

## [0.6.6] - 2026-10-05

### Changed

- The consensus floor, `VENDORED_MIN_SUPPORTED_VERSION`, is back to `>=0.19.0`.
  The app ships the #308 apply change in 0.19, so that release is the floor; at
  `>=0.20.0` a 0.19 build would withhold itself from its own meshes. (#317)

## [0.6.5] - 2026-10-01

### Added

- `setMeshName` names a mesh for every member in it. `setMeshLabel` only
  names it for the member who set it, so someone who joined a shared mesh read
  it unnamed. `listMeshes` and `meshesWatch` rows carry the shared name as
  `name`, and `meshesWatch` emits when another member renames the mesh. A build
  older than this one halts on the new `name-mesh` op, so every member's devices
  need this release before a mesh is named.

  ```js
  await engine.setMeshName({ meshId, name: 'Design team' })
  const { meshes } = await engine.listMeshes({})
  meshes.find((mesh) => mesh.meshId === meshId).name // 'Design team', on every member
  ```

  (#310)

- `moveChatToMesh` moves a chat to another mesh with its files and its running
  turn: the copy lands at once under `targetChatId`, the turn is retried there,
  and the source is purged once every file has arrived. `chatMoveWatch` reports
  the move, and `setChatAgent` hands a chat to another agent of its mesh. Until
  its bytes arrive, a moved attachment's `blobId` is `PENDING_BLOB_REFERENCE`,
  which `downloadAttachment` rejects with `blob unavailable`. (#312)
- `chunksDeltaWatch` streams an open chat as changes: a `reset` with the whole
  selection first, then only the rows appended, edited or reordered, and the ids
  of rows that left. A transcript that re-rendered the whole chat on every
  streamed chunk pays for one row per chunk instead; `chunksWatch` is
  unchanged. (#314)

### Changed

- The consensus floor, `VENDORED_MIN_SUPPORTED_VERSION`, is `>=0.20.0`. How a
  re-paired device's removal is weighed changed in apply, so a device on an
  older build would read a shared mesh differently. Ship the 0.20 app before
  publishing this floor to the lane cores. (#308)
- `@qvac/harness` is `^0.7.2`. `web_fetch` attaches a plain-text file it
  fetched to the chat beside returning its text, and devices on the `mid`
  profile and up speak with `Supertonic3-FP16` at 16 steps instead of
  `Supertonic3-Q8_0` at 5, so a host that prefetches the infra models downloads
  the FP16 model once. (#311)

### Fixed

- A device unpaired and paired back gets every project back, however its
  removal synced, and one that left a shared mesh on its own comes back as soon
  as it asks; only another member's removal still needs a grant. A re-paired
  device still live on its old writer is moved onto its new one instead of
  staying a reader, and a late leave no longer turns a kick into a leave. A
  consensus change, covered by the `>=0.20.0` floor. (#308)
- A member re-invited to a mesh it left brings every device back, not only the
  one that redeemed the invite. A device asking its siblings to admit it asks
  again, about once a second for up to a minute, while they are mid-join,
  instead of waiting as a reader until the next restart. (#307)
- `leaveMesh` on the account is no longer refused while this device holds
  another mesh: it departs each of them as this device alone, then leaves the
  account. Unpairing a device that held a project did nothing. (#306)
- `chatActivityWatch` no longer fails on every tick after a fast-forward leaves
  its cached view head undiffable. It rebuilds from the current view instead;
  before, the error repeated until restart. (#301)
- `modelCatalogWatch` bumps only when the custom-model set changed. It bumped on
  every device-local write, several times a second while a reply streamed. (#300)
- A typed harness can ask `fetchAttachment` for the newest audio. (#309)
- PDF extraction works on Android again: `bare-pdfium` 1.5.5 links its C++
  runtime into the addon, which 1.5.4's prebuilds left undefined. (#305)

## [0.6.4] - 2026-09-30

### Removed

- The collabora office adapter and its `@qvac/core/rag/extract/office` export.
  Office extraction is `extractOfficeText` from `@qvac/harness/office`, passed
  through the `extractors.office` option. (#285)

## [0.6.3] - 2026-09-30

### Changed

- `@qvac/harness` is `^0.7.1`, the first harness that names `isLoading` on
  `listModels` rows. Before it every row read `false`. (#288)

## [0.6.2] - 2026-09-30

### Added

- `modelUsers` names the agents on this device that use a model, for a Models
  screen to show before a delete and offer to switch them to another model. It
  counts the model each agent actually runs here, including a skill's image or
  music model and the model a phone clamps an oversized pick to.

  ```js
  const { agents } = await engine.modelUsers({ name: 'Qwen3.5-32B' })
  ```

  (#277)

- `listModels` rows carry `taskType`, what the model is for, so a Models
  screen groups by task rather than by the addon in `type`: `whisper` and
  `parakeet` are both `speech-to-text`. `listModels({ taskType })` keeps only
  that task's models. The harness names it, from `@qvac/harness` 0.7.0.

  ```js
  const { models } = await engine.listModels({ taskType: 'speech-to-text' })
  ```

  (#278)

- Whether a chat was read now reaches every device of the mesh.
  `markChatRead({ meshId, chatId })` marks a chat read up to its newest chunk,
  and every chat row carries `readThrough`, the next unread seq, so a client can
  clear an unread mark whose event `seq` is below it. It rides `put-chat` and
  never lowers, so it needs no new mesh route and older builds keep applying
  chats. A read is per chat, not per person.

  ```js
  await engine.markChatRead({ meshId, chatId })
  ```

  (#283)

- `isLoading` on `listModels` rows: true while the harness loads a chat model
  into memory for the boot warm, `loadModel` or a run this device serves, with a
  `modelCatalogWatch` bump when it turns on and again when it turns off. A
  Models screen or host bar can say a model is loading at boot, before any
  message is sent. The harness names it, from `@qvac/harness` 0.7.1; an older
  harness lists every row as `false`, and other rows read `false` for now.

  ```js
  const { models } = await engine.listModels({ cachedOnly: true })
  const loading = models.filter((model) => model.isLoading)
  ```

  (#270)

- `modelsWatch`: the `listModels` rows as a stream, sent again when a load,
  unload, download or custom-model change alters a field a row carries, so a
  Models screen sees a model start loading and become ready without re-reading
  `listModels` on each `modelCatalogWatch` bump.
  `excludeCustom` leaves out the models the user added, on `listModels` too.

  ```js
  for await (const { models } of engine.modelsWatch({ cachedOnly: true })) render(models)
  ```

  (#271)

### Changed

- `deleteChat` purges the chat on every device, with the file bytes and index
  rows it held, and a device that joins later gets none of it; `deleteAgent`
  purges every chat the agent answered the same way. A device on an older build
  halts on the purge until it updates. This was in the 0.6.1 build unannounced.
  (#266)
- `engines.bare` is `>=1.34.0`. `bare-runtime` is pinned to 1.34.0 and
  `bare-sidecar` to 0.5.7 (Bare 1.34.0) across the tree, with `bare-thread` at
  least 1.2.7 and `bare-module` 7.1.0 for `bare-worker`'s copy: a worker that
  starts inside a bundle needs `module.resolutions`. (#268)
- `bare-module` is no longer overridden to 6.4.0, and `bare-module-traverse` is
  overridden to `~2.5.8`, which keeps the addon and asset conditions Bare needs to
  load a bundle's native files. (#268)
- The collabora worker's entry is now in sight of a bundler. A host that stows
  core carries `bare-collabora` in the bundle for office conversion, or defers
  it and gets "the document engine failed to load". (#268)
- A conversion whose engine thread dies reports what killed it after "the
  document engine closed unexpectedly", and a malformed job ends the thread at
  once instead of waiting out the deadline. (#268)
- `bare-channel` is no longer a direct dependency; `bare-worker` brings it. (#268)

### Fixed

- The collabora worker starts on Bare 1.33 and later, whose threads cannot read
  a module off disk. It is spawned through `worker_threads`, which the package
  maps to `bare-worker` on Bare, and its entry is named with a literal
  `#collabora-worker-entry`, so its graph is bundled into the thread. (#268)
- `duck` crashed at start on Bare 1.33 and later, `--help` and `--version`
  included, with "Invalid left-hand side expression in prefix operation": Bare
  now links what `import.meta.resolve()` names, and the TUI named a `SKILL.md`.
  This was in the 0.6.1 build unannounced. (#267)

## [0.6.1] - 2026-09-29

### Fixed

- A connected skill's OAuth token and settings reach the harness again. Since
  0.4.0 the credential pusher listed agents without naming the account mesh, so
  every push failed before `setCredentials` and a skill read `needs-setup` as if
  it had no credential. The pusher now lists the account mesh's agents, and
  between accounts pushes the shared scope alone. (#265)

## [0.6.0] - 2026-09-28

### Added

- Loading and unloading a model by hand, for a Models screen. `loadModel` loads
  a downloaded model under the settings of the agent on this device that runs
  it, so that agent's next reply finds it loaded; it never downloads, and returns
  `loaded: false` with `reason: 'memory'` when it would not fit beside what is
  loaded. Chat models loaded this way stay loaded side by side. `unloadModel`
  puts a reply this device is generating with the model back in the queue, and it
  completes once the model has been loaded again. Both bump `modelCatalogWatch`,
  and `isLoaded` in `listModels` is right for chat, embedding, speech and
  transcription models. A harness older than `@qvac/harness` 0.6 refuses both.

  ```js
  const { loaded, reason } = await engine.loadModel({ name: 'Qwen3.5-4B-Q4_K_M' })
  await engine.unloadModel({ name: 'Qwen3.5-4B-Q4_K_M' })
  ```

  (#242)

- `previewCustomModel` checks a link or path through the harness before
  anything is added, and returns the resolved link, size, context window,
  architecture, size label, task type, license and fit, a file list for a
  repository with several weights, or a refusal with its reason.
  `customModelsWatch` rows carry `contextLength`, `taskType`, `license` and
  `label`. (#215)
- An attached PDF's scanned, figure and text-less pages reach a vision model as
  images, at most 10 per message, alongside the PDF as a document. A PDF whose
  pages rendered is no longer reported as unread. Core now depends on
  `bare-pdfium`. (#94)
- `setModelReleased({ name, released })` and `releasedModels` on the app
  config: the models this device does not fetch ahead of need. (#189)

### Changed

- A custom model is named by an id derived from its file (`custom:…`), not by
  what the caller typed. `addCustomModel` takes a `label` in place of `name` and
  returns `{ id }`, and `removeCustomModel`, `deleteModel` and an agent's
  `modelName` take that id. `addCustomModel` runs the preview first and rejects
  a refused source, a multi-weight repository or a model that is not a text
  model, storing nothing; with no harness that can preview, it rejects.
  `removeCustomModel` also frees the downloaded copy and answers with the
  `deleteModel` summary in place of `{ ok }`. Needs `@qvac/harness` 0.6. See
  [custom models](docs/api/models.md#custom-models). (#215)

  ```js
  // 0.5.0
  await engine.addCustomModel({ name: 'Qwen3 small', src })
  await engine.removeCustomModel({ name: 'Qwen3 small' })
  // 0.6.0
  const { id } = await engine.addCustomModel({ label: 'Qwen3 small', src })
  await engine.removeCustomModel({ name: id })
  ```

- `deleteModel` no longer has the model downloaded again straight away. It
  stops an in-flight transfer and releases the model, which is fetched again
  only when a run needs it or on `retryModelDownload`. (#189)
- `@qvac/harness` 0.6.0, with `@qvac/inference` 0.20.0. (#215)
- For a host embedding Core, `startOAuthLoopback` is now
  `openOAuthLoopback(port, { credentialKey, state })`, and `waitForCode` no
  longer takes the state. One server per fixed port is shared by every flow
  redirecting to it. (#181)

### Fixed

- Two OAuth flows landing on the same loopback port superseded each other, so
  sibling skills of one provider could not connect at the same time. A callback
  is now routed to the flow whose `state` it carries. (#181)
- `networkWatch` and `diagnosticsWatch` logged two churn lines a second on an
  idle device. A sampled watch that wakes with the same answer is no longer
  counted as churn, and a real burst is reported once per window. (#145)

## [0.5.0] - 2026-09-26

### Added

- "Free up memory when idle" reaches the harness. A device's choice lives under
  the device-local config key `model.idleUnloadMinutes` (`MODEL_IDLE_UNLOAD_KEY`
  from `@qvac/core/constants`), as one of `MODEL_IDLE_UNLOAD_MINUTES`: 15, 30,
  60, 120, 240, 480, 720 or 1440. The assistant pushes it to the harness as
  `setModelIdleTimeout`, which unloads every idle model once the device has had
  no request for that long. An absent key, `0` or any other value is Never,
  today's behaviour. A harness older than `@qvac/harness` 0.5 ignores it. (#241)

  ```js
  await engine.configSet({ key: MODEL_IDLE_UNLOAD_KEY, value: 30 })
  ```

- `previewMeshInvite` reads whether an invite adds a device to an existing
  member or mints a new person, without joining. A device invite now carries
  `inviterName`, the minting member's display name, which the preview returns.
  An invite that does not decode is refused with `Invalid mesh invite`. (#194)

- `createMesh` mints a shared mesh, optionally a compute one. It takes
  `{ config: { compute } }`, typed `AssistantMeshConfig`, and returns
  `{ meshId }`, as `createRoom` did. (#198)

  ```js
  const { meshId } = await engine.createMesh({})
  const compute = await engine.createMesh({ config: { compute: true } })
  ```

- A run can invoke a harness capability without loading a model. `runAgent`,
  `sendMessage` and `runTask` take `capability`, `capabilityArgs` and
  `enhance` (`never`, the default, or `auto`). The run is claimed, stopped and
  reports progress like any other, and a capability the executing device's
  harness does not know fails the run with a notice. `runTask` returns
  `metrics`. See `examples/mesh-capability-run.mjs`. (#162)
- `detectLanguage`: the language a piece of text is in, ranked. Device-local
  and synchronous; the classifier ships in the harness bundle, so it needs no
  model. (#162)
- `meshEntry.reason` and `meshEntry.awaitingFrom`: a mesh this device was never
  admitted to reports `awaiting-admission` and names the one device that can
  admit it. (#174)

### Changed

- The consensus floor, `VENDORED_MIN_SUPPORTED_VERSION`, is `>=0.19.0`. This
  release sends dispatch routes 28 to 37, which app 0.18.x (`@qvac/core` 0.1.x)
  cannot route, and a device that cannot route an op halts apply. Route 34
  writes the account seal on its first settle, so an un-upgraded device of that
  account halts at once. Ship the 0.19 app before publishing this floor to the
  lane cores. A host embedding this release that reports an app version below
  0.19.0 is withheld from its meshes as needing an upgrade; a prerelease such as
  `0.19.0-dev` counts as 0.19.0, and a host that reports none is not gated.
  (#196)
- A shared mesh admits a writer only through an invite grant or a live
  device's vouch. `meshInvite` with `member: true` puts a single-use grant
  behind the link that expires after 48 hours, and every call mints a fresh
  one, so each person needs their own link. An invite minted before grants
  leaves the joiner a reader, and `joinMesh` fails after 60 seconds.
  (#171, #199, #225)
- `joinMesh` fails with `This invite was revoked`, `This invite has expired` or
  `This invite has already been used` when the device can already see why, and
  a member or device invite join that is not admitted within 60 seconds fails
  instead of waiting forever. Only `recoverAccount` still waits unbounded.
  (#171, #229)
- A device invite expires after 48 hours, a device keeps at most five
  outstanding, and one minted before this release no longer redeems. The
  joining device no longer appends its own join: it sends a signed claim to the
  inviting device, which writes the admission. The link format is unchanged.
  (#229)
- An account is sealed the first time a device on this release settles it, and
  from then on refuses the bare seed `@qvac/join`, invite grants and
  `@qvac/add-writer`: pairing and `recoverAccount` are the only ways in.
  Booting with another account's `meshSeed` and `meshKey` leaves the device a
  reader, with a `meshStatusWatch` error saying to pair it with a device
  invite. A host that boots every device on one configured `meshSeed` is
  unaffected until it pairs a device in. (#229)
- `recoverAccount` joins through `@qvac/recover-device`, on a proof the
  phrase's identity signs, and is refused in a shared mesh and for a device
  another writer removed. `publishAccountRecovery` refuses a phrase that names
  no member of the account. (#200, #225)
- A shared mesh takes its member from the account, so every device of one
  person is the same member in it. `createMesh`, and a member `meshInvite` that
  mints the shared mesh, refuse with "This device is not part of its account
  yet" until the account row names that member. A sibling that follows a
  shared mesh opens it read-only until a live device of the same member admits
  it. A shared mesh refuses `@qvac/join-member` and a self-signed
  `@qvac/attest-member-device`, so a member link there comes only with
  admission. (#174, #226, #227)
- A shared mesh starts with no agent and no chat, both when it is created and
  when a member joins. Read `agents` after a join as possibly empty rather than
  taking `agents[0]`. The account still starts with its default agent and a
  first chat. (#188)
- A device's build and inventory go only to its own account. In a shared mesh
  `appVersion`, `appBuild` and `appChannel` are withheld, the installed and
  cached inventory is reported empty, and `readySkillNames` carries only the
  agents the device hosts there. Read another device's tools and skills off the
  account's roster. (#173)
- Removing a device or a member revokes the live invite grants it minted, a
  kick lands even after the device moved to a new writer key, and a device row
  that moves to a new writer removes the one it moved off. Consensus changes,
  covered by the `>=0.19.0` floor. (#226)
- Revoking another writer takes standing: `removeDevice` and `removeMember` are
  refused in apply unless the author is a live device of a member of the mesh.
  Any admitted writer could revoke any other before, including a device paired
  in by invite that a sibling has not yet attested. A refusal leaves the writer
  set untouched. A consensus change, covered by the `>=0.19.0` floor. (#170)
- Notice and error text says "mesh" where it said "room". A member `meshInvite`
  into a mesh that already holds another member or a message returns the
  `notice` "this mesh is not empty: everyone in it will see the newcomer arrive,
  and the newcomer replays the whole history of the mesh, including what earlier
  members wrote", and a member `meshInvite` naming a mesh only another of your
  devices can open refuses with "Another of your devices holds this mesh: bring
  that device online, or invite from it instead". Code matching on the old text
  has to match the new. (#198)
- `autobee` 2.11.8. A member whose view was never written now maps through the
  reindex, and the fast-forward search follows signalled trusted heads and only
  moves forward. (#249)

### Removed

- `createRoom`. It stays on the wire because it shipped, and now refuses with
  `createRoom is retired: call createMesh with the same input`. For a host
  embedding Core, `Core.createRoom` and `Core.sharedRoom` are renamed
  `createMesh` and `sharedMesh`. (#198)

### Fixed

- A mesh a device learned of from a sibling was followed once, ever: one
  refused seed request or failed open stranded it for good, with nothing
  logged. A failed open now unwinds, the reason is logged, and a follow that
  failed for a reason that can change is retried on every sync pass until the
  mesh opens. A refusal is not retried. (#172, #201)
- `removeDevice` on one of your own devices revoked it only in the account, so
  it stayed a live writer, and a live voucher, in every other mesh. It is now
  revoked in each mesh this device holds, and in any other as soon as it
  opens. Whether a sibling may follow our meshes is read off the account alone,
  so one revoked by another member in a single mesh is no longer refused the
  seed of all of them. (#228)

## [0.4.1] - 2026-09-25

### Changed

- `autobee` 2.11.5, which also reindexes its system view on boot, alongside the
  strict reindex 0.4.0 brought in. `hyperbee2` is pinned to 2.18.0 and
  `hyperdb` needs 6.9. (#230)

### Fixed

- A React Native app could not bundle `@qvac/core/oauth/client`: Metro rejects
  this package's imports map, so `#abort-controller` did not resolve. Token
  refresh now uses the runtime's own `AbortController`, and
  `bare-abort-controller` only on Bare, which has none. React Native's `fetch`
  gets a native signal too. 0.4.0 and 0.3.4 are affected. (#231)

  ```js
  // mobile: bundles again, nothing else changes
  import { createOAuthClient } from '@qvac/core/oauth/client'

  const oauth = createOAuthClient({ fetch, randomBase64Url, sha256Base64Url })
  const tokens = await oauth.refreshOAuthTokens(config, refreshToken)
  ```

## [0.4.0] - 2026-09-24

### Added

- `account` and `accountWatch`: the account's `meshId`, whether it is writable,
  and the user's display name, so a host no longer picks the account out of the
  mesh list. The watch emits again after a kick or leave mints a new account.
  (#155)

  ```js
  const { meshId, writable, displayName } = await engine.account({})

  for await (const account of engine.accountWatch({})) {
    showAccount(account.meshId, account.displayName)
  }
  ```

- `listChats` and `chatsWatch` take `limit` and `cursor`, and the list carries
  `nextCursor`. A limit returns the newest page, oldest-first inside it, and
  `nextCursor` is set only while an older page exists. Leaving `limit` out
  returns the whole list, as before. (#168)

  ```js
  let page = await engine.listChats({ meshId, limit: 50 })
  render(page.chats)
  while (page.nextCursor) {
    page = await engine.listChats({ meshId, limit: 50, cursor: page.nextCursor })
    renderAbove(page.chats)
  }
  ```

- A device-local index of the files a device holds, served by `listLocalFiles`.
  `Core.clearOldFiles({ olderThanMs, includeOwn })` clears the bytes of files
  not read since a cutoff and resolves with how many it cleared. A later read
  fetches them back. Your own uploads are kept unless `includeOwn` is `true`.
  The `fileGc` Core option runs the same sweep on an interval, and is off
  unless set. Files an older build left behind are backfilled once per mesh,
  so they can be reclaimed too. (#183)

  ```js
  const DAY = 24 * 60 * 60 * 1000
  const core = new Core(() => server, {
    storagePath,
    device,
    fileGc: { maxAgeMs: 30 * DAY, intervalMs: DAY }
  })

  const cleared = await core.clearOldFiles({ olderThanMs: 30 * DAY })
  const { files } = await engine.listLocalFiles({ meshId })
  const held = files.filter((file) => !file.cleared)
  ```

- `getDefaultAgent` and `getDevice` read one row off an index, where a caller
  used to list and search. `listAgents` and `agentsWatch` take an optional
  `providerDeviceId`. (#183)

  ```js
  const { id: deviceId } = await engine.deviceInfo({})
  const { agent } = await engine.getDefaultAgent({ meshId, providerDeviceId: deviceId })
  const device = await engine.getDevice({ meshId, deviceId })
  const { agents } = await engine.listAgents({ meshId, providerDeviceId: deviceId })
  ```

### Changed

- **Breaking:** every mesh-backed route takes a required `meshId`, and Core
  holds a pool of meshes rather than a selected one. A route opens a mesh this
  device belongs to on demand, and a watch ends with the mesh it names.
  `selectMesh` is gone, and which mesh a window shows is the host's own state.
  `meshStatusWatch` loses `writable`, `meshKey` and `discoveryKey`, a
  `listMeshes` row loses `active`, `meshEntry.home` is now `account`, and `wasHome` is now
  `wasAccount`. `leaveMesh` names the mesh it leaves, and `meshInvite` with no
  `meshId` is a device invite for the account. hrpc route ids after
  `selectMesh` shift down by one, so Client and Core ship together. (#155)

  ```js
  // 0.3
  await engine.selectMesh({ meshId: room.meshId })
  const { chats } = await engine.listChats({})
  const { meshes } = await engine.listMeshes({})
  const home = meshes.find((mesh) => mesh.home)
  for await (const { writable } of engine.meshStatusWatch({})) showWritable(writable)
  await engine.leaveMesh({})

  // 0.4
  const { chats } = await engine.listChats({ meshId: room.meshId })
  const { meshId: accountId } = await engine.account({})
  for await (const { meshes } of engine.meshesWatch({})) {
    showWritable(meshes.find((mesh) => mesh.meshId === room.meshId)?.writable)
  }
  await engine.leaveMesh({ meshId: room.meshId })
  ```

- **Breaking:** `listChunks`, `chunksWatch`, `listAttachmentsByKind`,
  `listToolActivity` and `toolActivityWatch` take a `gt`/`gte`/`lt`/`lte` range
  in place of `fromSeq`, `fromCreatedAt` and `beforeSeq`. `fromSeq` and
  `fromCreatedAt` were inclusive floors, so they become `gte`, and `beforeSeq`
  was an exclusive ceiling, so it becomes `lt`. A `0` bound arrives as absent
  on the wire, so ask for the adjacent bound instead (`gt: 0` is `gte: 1`).
  (#168)

  ```js
  // 0.3
  await engine.listChunks({ chatId, fromSeq: 40 })
  await engine.listAttachmentsByKind({ kind: 'image', fromCreatedAt: since })
  await engine.listToolActivity({ agentId, beforeSeq: oldest.seq })

  // 0.4
  await engine.listChunks({ meshId, chatId, gte: 40 })
  await engine.listAttachmentsByKind({ meshId, kind: 'image', gte: since })
  await engine.listToolActivity({ meshId, agentId, lt: oldest.seq })

  // a page of history older than seq 120, newest first
  await engine.listChunks({ meshId, chatId, lt: 120, reverse: true, limit: 50 })
  ```

- **Breaking:** a request names each entity by kind (`agentId`, `chatId`,
  `groupId`, `deviceId`, `memberId`, `chunkId`) instead of `id`, and every
  create, update and rename takes what it sets under `config`. Response rows
  keep `id`. `renameDevice` always renames the calling device. `updateMember`
  takes no id or `meshId`: it renames the caller's own member in the account,
  and every other mesh picks the name up. (#178)

  ```js
  // 0.3
  await engine.createChat({ agentId, title: 'Plans' })
  await engine.renameChat({ id: chatId, title: 'Trip plans' })
  await engine.updateAgent({ id: agentId, modelName: 'Qwen3.5-9B' })
  await engine.setChatGroup({ id: chatId, groupId })
  await engine.resolveApproval({ id: approvalChunkId, approved: true })
  await engine.renameDevice({ id: deviceId, name: 'Laptop' })
  await engine.updateMember({ id: memberId, name: 'Ada', meshId })
  await engine.createRoom({ compute: true })

  // 0.4
  await engine.createChat({ meshId, agentId, config: { title: 'Plans' } })
  await engine.renameChat({ meshId, chatId, config: { title: 'Trip plans' } })
  await engine.updateAgent({ meshId, agentId, config: { modelName: 'Qwen3.5-9B' } })
  await engine.setChatGroup({ meshId, chatId, groupId })
  await engine.resolveApproval({ meshId, chunkId: approvalChunkId, approved: true })
  await engine.renameDevice({ meshId, config: { name: 'Laptop' } })
  await engine.updateMember({ config: { name: 'Ada' } })
  await engine.createRoom({ config: { compute: true } })
  ```

- `autobee` 2.11.4 with `strictReindex`: the boot reindex rewrites views still
  on a version 1 manifest, which autobee 2.11 will no longer append to. (#205)

### Deprecated

- The `setDisplayName` route now calls `updateMember`, and will be removed.
  (#178)

  ```js
  // instead of engine.setDisplayName({ name: 'Ada' })
  await engine.updateMember({ config: { name: 'Ada' } })
  ```

### Removed

- `Core.selectMesh` and `Core.setDisplayName`, for a host embedding Core.
  `Core.mesh` is the account. (#155, #178)

### Fixed

- `ragSearch` could search the selected mesh's vectors for a chat in another
  mesh. Every open mesh now indexes against its own vector index. (#155)
- A member renamed on one device could be renamed back by another device of
  the same member that held an older name. The newest name now wins. (#180)
- While one chat's image or music model was sampling, another chat's model
  load or a background download reset its phase, so its sidebar row and thread
  placeholder flickered back to running. (#202)
- OAuth token refresh failed on Node 24, including Electron 42, because the
  request carried a non-native `AbortSignal`. Calendar, Spotify and other
  connected skills stopped working an hour after connecting. (#207)

## [0.3.5] - 2026-09-25

### Changed

- `autobee` 2.11.4 with `strictReindex`: the boot reindex rewrites views still
  on a version 1 manifest, which autobee 2.11 will no longer append to.
  `corestore` 7.12.6 and `hypercore` 11.37. (#205)

### Fixed

- A React Native app could not bundle `@qvac/core/oauth/client`: Metro rejects
  this package's imports map, so `#abort-controller` did not resolve. Token
  refresh now uses the runtime's own `AbortController`, and
  `bare-abort-controller` only on Bare, which has none. React Native's `fetch`
  gets a native signal too. (#231)

  ```js
  // mobile: bundles again, nothing else changes
  import { createOAuthClient } from '@qvac/core/oauth/client'

  const oauth = createOAuthClient({ fetch, randomBase64Url, sha256Base64Url })
  const tokens = await oauth.refreshOAuthTokens(config, refreshToken)
  ```

## [0.3.4] - 2026-09-24

### Fixed

- OAuth token refresh failed on Node 24, including Electron 42, because the
  request carried a non-native `AbortSignal`. Calendar, Spotify and other
  connected skills stopped working an hour after connecting. (#207)

## [0.3.3] - 2026-09-24

### Changed

- `@qvac/harness` 0.3.3 and `@qvac/skills` 0.1.9. The harness moves to
  `@qvac/sdk` 0.20, and some addons now ship per-platform prebuild packages,
  so a host that bundles Core should read the harness 0.3.3 notes. (#203)

### Fixed

- `listChatActivity` and `chatActivityWatch` reported `generating-image` or
  `generating-audio` for the whole time a media model was downloading or
  loading. That wait now reads as `running`, and the media state starts with
  the first sampling tick. (#177)

## [0.3.2] - 2026-09-23

### Added

- XLSX and PPTX uploads are indexed as Knowledge and retrieved like other
  documents, including uploads that another client sends to a desktop host.
  Nothing changes for the caller: upload them the way you upload a PDF.
  Requires `rag-extract` 0.1.1. (#161)
- In a chat where more than one person speaks, each user turn reaches the model
  with its sender's name, so an agent can tell who asked for what. A chat with
  one speaker produces the same prompt as before, so its KV cache still
  matches. (#102)

### Changed

- **Breaking:** OAuth provider config moves out of Core and into each skill's
  manifest. Core keeps a generic engine, and the provider-named functions are
  gone: read the skill catalog, look up the spec for a credential key, and run
  the flow from it. `cancelOAuthFlow` takes `{ credentialKey }`. A skill
  manifest is replicated content, so `specFromRoute` drops any route it cannot
  run safely. (#169)

  ```js
  // 0.3.1
  import { connectGoogle } from '@qvac/core/oauth'

  const tokens = await connectGoogle({
    clientId,
    clientSecret,
    credentialKey: 'gmail_access_token',
    openUrl
  })

  // 0.3.2
  import { buildProviderConfig, oauthSpecFor, runOAuthFlow } from '@qvac/core/oauth'

  const { skills } = await engine.skills({ agentId })
  const spec = oauthSpecFor(skills, 'gmail_access_token')
  const tokens = await runOAuthFlow(buildProviderConfig(spec, { clientId, clientSecret }), {
    openUrl
  })
  ```

- `@qvac/harness` 0.3.1 and `@qvac/skills` 0.1.6. (#191)

### Removed

- The provider-named OAuth exports (`connectGoogle`, `exchangeAsanaCode`,
  `refreshSpotifyToken`, every `*_CREDENTIAL_KEY` constant and the rest),
  `providerRequiresSecret`, `providerSupportsDcr`,
  `providerSupportsSharedIosSession`, `OAUTH_PROVIDERS` and
  `verifyOAuthTokens`. Read the same facts off the spec instead. See
  [`docs/api/runtime.md`](docs/api/runtime.md) for the full list. (#169)

  ```js
  // instead of providerRequiresSecret(provider)
  const needsSecret = spec.tokenAuth !== 'pkce-only'
  // instead of providerSupportsDcr(provider)
  const registers = Boolean(spec.registrationEndpoint)
  // instead of providerSupportsSharedIosSession(provider)
  const shared = spec.sharedIosSession === true
  ```

### Fixed

- A device that booted straight into a room showed every mesh unnamed, and
  `shared`/`sharedAt` were wrong after a restart. A boot now always opens the
  account next to the mesh it lands on. (#150)
- A `closeMesh` that landed while the same mesh was still opening closed
  nothing, and left the mesh open and replicating. (#150)
- `duck`'s `/save` dropped the extension of every attachment that was not a
  JPEG or PNG, so a saved `.mp4` or `.pdf` would not open. (#182)

## [0.3.1] - 2026-09-22

### Added

- The prompt inspector: `inferenceCalls` returns the model calls recorded for a
  chat, merging the rounds this device ran with those the agent's host ran.
  Nothing is recorded until the device-local `inspector.captureInferenceCalls`
  key is set to the string `'on'`. Records stay on the device, are dropped with
  their chat, and are pruned by count and age. (#58)

  ```js
  await engine.configSet({ key: 'inspector.captureInferenceCalls', value: 'on' })

  const { calls, truncated } = await engine.inferenceCalls({ chatId })
  for (const { runId, at, call } of calls ?? []) inspect(runId, at, call)
  ```

- `senderMemberId` on a user message's chunk, stamped by Core, so a message
  records which member sent it even after the device that wrote it is removed.
  Messages from before this carry none. (#101)

  ```js
  const { chunks } = await engine.listChunks({ chatId, type: 'user-message' })
  const { members } = await engine.listMembers({ meshId })
  const sender = (chunk) =>
    members.find((member) => b4a.equals(member.id, chunk.senderMemberId))?.name
  ```

### Changed

- The extraction, chunking and retrieval pipeline comes from `rag-extract`, and
  behaviour is unchanged. A host that gates installs on release age has to
  exempt `rag-extract`. (#112)

  ```toml
  # bunfig.toml
  [install]
  minimumReleaseAgeExcludes = ["rag-extract"]
  ```

- `autobee` 2.10. The on-disk record layout is unchanged, so released peers
  still read it. (#154)
- `@qvac/harness` 0.2.9, which sends `stopReason`, so `duck` now marks an
  answer the context window cut short. (#163)
- `deleteChat` also drops the chat's prompt-inspector records, and fails if
  that drop fails. (#58)

### Fixed

- A new room could be created with the device's name as the member name, when
  the user had already given their own name. Co-members saw the device name
  until a rename caught up. (#159)

## [0.3.0] - 2026-09-21

### Added

- `verifyOAuthTokens` checks a fresh token before a host saves it: it refuses an
  Asana token from a non-MCP app, and a Spotify account without Premium. A
  network error or timeout still lets the connect go through. (#136)

  ```js
  import { verifyOAuthTokens } from '@qvac/core/oauth'

  const result = await verifyOAuthTokens(credentialKey, tokens.accessToken, fetch)
  if (!result.ok) throw new Error(result.error) // e.g. OAuth error: spotify_premium_required
  ```

- `duck`: `/usage` shows how full the chat's context window is and what fills
  it, the palette completes each command's verbs (tab or enter), and a new
  session reopens the agent and chat the last one left active. (#132, #133,
  #134)

  ```
  /usage        the window, what fills it, and the chat's totals
  /chat n       completes to /chat new and runs it
  ```

### Changed

- A watch opened without a `meshId` stayed on the mesh selected when it
  opened. It now ends when the selection moves, and the caller reopens it on
  the mesh it wants. Omitting `meshId` is deprecated. To keep one watch across
  a selection change, name its mesh. (#139)

  ```js
  // ends when the user selects another mesh
  for await (const frame of engine.chatsWatch({})) render(frame)

  // stays on the mesh it names
  for await (const frame of engine.chatsWatch({ meshId })) render(frame)
  ```

- `runRequestsWatch` only serves the requests whose agent names the calling
  device. (#144)
- A chat is compacted only before a run starts, never after an answer. The
  turn that crosses the threshold finishes untouched, and the next message
  folds first. (#130)

### Fixed

- After switching mesh, the assistant stopped claiming runs, so no model
  loaded for a request on the newly selected mesh. (#139)
- `listKnowledge`, `listIndexing`, `knowledgeWatch`, `indexingWatch` and
  `indexingProgressWatch` ignored the `meshId` they were given and answered
  for the selected mesh instead. (#142)
- A device name had no length limit, and a very long one broke the room UI.
  Names are now capped at 100 characters, and a longer one is refused. (#84)

## [0.2.2] - 2026-09-18

### Added

- Compute meshes: `createRoom({ compute: true })` makes a mesh that holds only
  devices and members, so a device can lend its model to another device
  without receiving its chats, knowledge or agents. The borrower keeps the run,
  and only the completion call crosses the wire. (#67)

  ```js
  // the device with the model
  const { meshId } = await desktop.createRoom({ compute: true })
  const { invite } = await desktop.meshInvite({ member: true, meshId })

  // the device that borrows it
  await phone.joinMesh({ invite })
  const { id, computeLenderId } = await phone.deviceInfo({})
  await phone.createAgent({
    name: 'Borrower',
    bio: 'runs here, thinks there',
    providerDeviceId: id,
    modelName: 'Qwen3.5-9B',
    lenderDeviceId: computeLenderId
  })
  ```

- Runs are served from every open mesh, not only the selected one, so a
  co-member's message in a room is answered while the host is looking at
  another mesh. (#93)
- `listDevices`, `devicesWatch` and `listMembers` take a `meshId`, and
  `membersWatch` is new. A background run can read the rosters of its own
  mesh. (#87, #122)

  ```js
  const { devices } = await engine.listDevices({ meshId: room.meshId })
  for await (const { members } of engine.membersWatch({ meshId: room.meshId })) {
    render(members)
  }
  ```

- `updateMember` and `removeMember`. Any member may remove another, and doing
  so revokes every device of that member at once. A removed member no longer
  appears in `listMembers`. A device cannot remove its own member. (#89, #92)

  ```js
  await engine.updateMember({ id: memberId, name: 'Ada at work', meshId })
  await engine.removeMember({ id: otherMemberId, meshId })
  ```

- `shared` and `sharedAt` on each mesh entry, marking the room a member invite
  reuses. (#91)

  ```js
  const { meshes } = await engine.listMeshes({})
  const sharedRoom = meshes.find((mesh) => mesh.shared)
  ```

- `listArchivedMeshes`, `archivedMeshContents` and `migrateArchivedMesh`: after
  a device invite moves a device onto another account, the account it left can
  be counted and its chats, agents and knowledge copied across. A second
  migrate answers `migrated: false`. (#105)

  ```js
  await phone.joinMesh({ invite: (await laptop.meshInvite({})).invite })

  const [left] = (await phone.listArchivedMeshes({})).meshes ?? []
  const { chats, agents, knowledge } = await phone.archivedMeshContents({ meshId: left.meshId })
  if (await askUser(`Bring over ${chats} chats, ${agents} agents, ${knowledge} documents?`)) {
    await phone.migrateArchivedMesh({ meshId: left.meshId })
  }
  ```

- Account recovery from the identity phrase: `accountRecoverable`,
  `recoveryPublish` and `recoverAccount`. A copy of the account seed that only
  the phrase can open is mirrored by the blind peers, so a wiped device can get
  its account back. An account made before this has to be published once.
  (#107)

  ```js
  // once, on a device that has the account
  const { recoverable } = await engine.accountRecoverable({})
  if (!recoverable) await engine.recoveryPublish({ phrase })

  // on a wiped device
  await engine.recoverAccount({ phrase, timeout: 30_000 })
  ```

- `displayName` and `setDisplayName`: a member is named after its user rather
  than after the device that founded it. The account is minted before
  onboarding runs, so set the name once the user has entered it. (#108, #109)

  ```js
  await engine.setDisplayName({ name: 'Ada' })
  const { name } = await engine.displayName({})
  ```

- `sortChatGroupsByName`. Groups nobody has arranged sort by name, and this
  drops every arrangement to go back to that order. (#110)

  ```js
  const { groups } = await engine.sortChatGroupsByName({})
  ```

- Transcription resolves the newest audio attachment when no id is given.
  (#66)
- `duck`: `/leave`, `/compact`, a marker where a chat was compacted, `/ctx`
  and a menu entry to set the agent's context size, and a note when the
  context window cut an answer short. (#86, #127, #129)

  ```
  /leave        leave the mesh in use
  /compact      compact the chat now
  /ctx 8k       run the agent at an 8,192-token window; /ctx auto clears it
  ```

### Changed

- An approval rule records the member who wrote it, and only applies to that
  member. In a shared room, one member's standing rule no longer approves
  another member's tool calls. A rule written before this has no author and
  applies to nobody, so its call is asked again. (#123)

  ```js
  const { rules, ourMemberId } = await engine.listApprovalRules({ meshId })
  const mine = rules.filter((rule) => rule.memberId && b4a.equals(rule.memberId, ourMemberId))
  ```

- A room's default agent is named after the member whose device runs it,
  rather than after the built-in agent. (#96)
- When a member leaves a room on one device, the room is also retired on that
  member's other devices. (#95)

### Fixed

- The turn that triggered compaction lost its own answer from later prompts,
  and on 4k and 8k windows compaction ran a turn too late. The threshold now
  depends on the window size. (#126)
- When two devices of one member redeemed the same member invite, the room
  ended up with two members instead of one member with two devices. (#111)
- With a room selected, a device invite targeted the room and was refused. It
  now targets the account. (#81)
- The inviter's `meshesWatch` never saw a member join a room it was not
  looking at. (#100)
- A member invite warned that a room with only its own member in it was not
  empty. (#97)
- With Knowledge off, a document over 20 MiB was not read at all. Its opening
  is now read whatever the file's size. (#83)

### Security

- Once a mesh holds a verified device signature, it refuses unsigned device
  rows. Before this, any admitted writer could create or rewrite a device row
  for a key it did not hold. Meshes that predate this are sealed by the first
  signing build to boot on them. (#88)

## [0.2.1] - 2026-09-16

### Fixed

- When a user attached many documents and asked a topic-specific question,
  retrieval could leave some of them out. Every attached file now gets a share
  of the token budget. (#64)

## [0.2.0] - 2026-09-15

### Added

- Member invites: `meshInvite({ member: true })` opens a shared room and
  invites a second person into it as a member of their own, keeping their
  identity. The account is never invitable this way. `listMembers` returns the
  members, and the response's `notice` says when the room already holds
  people. (#49, #57)

  ```js
  // Ada
  const { invite, meshId, notice } = await ada.meshInvite({ member: true })

  // Ben, on his own device
  await ben.joinMesh({ invite })
  ```

- Multiple meshes per device: `listMeshes`, `meshesWatch`, `openMesh`,
  `selectMesh`, `closeMesh` and `setMeshLabel`, and a `meshId` on the agent
  and chat calls. Joining a room keeps the mesh already in use, the member's
  other devices pick the room up, and each member gets their own default agent
  in it, on their own device. (#50, #51, #52, #53, #54, #55)

  ```js
  const { meshes } = await engine.listMeshes({})
  // [{ meshId, state, writable, open, active, home, label, members }, …]

  const room = meshes.find((mesh) => !mesh.home)
  await engine.setMeshLabel({ meshId: room.meshId, label: 'Family' })
  await engine.selectMesh({ meshId: room.meshId })
  const { chats } = await engine.listChats({ meshId: room.meshId })
  ```

- `moveChat` and `moveChatGroup`: chats and groups can be dragged into an
  order. A dropped row lands directly below `afterId`, or at the top when it is
  left out, and a chat can change group in the same call. (#44)

  ```js
  await engine.moveChat({ id: chatId, groupId, afterId: chatAboveId })
  await engine.moveChat({ id: chatId }) // ungrouped, at the top
  await engine.moveChatGroup({ id: groupId, afterId: groupAboveId })
  ```

### Changed

- **Breaking:** a device is adopted into a member only if it presents a claim,
  so pairing needs an invite from an upgraded device. A device still on an
  older build connects, but is not listed as yours until it is updated and
  paired again. (#70)

  ```js
  // on the upgraded device
  const { invite } = await laptop.meshInvite({})
  // on the device being paired, once it runs 0.2.0
  await phone.joinMesh({ invite })
  ```

- **Breaking:** the member join is a new mesh route, and
  `VENDORED_MIN_SUPPORTED_VERSION` moves to `>=0.18.0`. A peer on an older
  build withdraws a mesh as needing an upgrade once a joined room is recorded
  in it. (#49, #55)
- `home` on a mesh entry now marks the account mesh, not the mesh this device
  minted. Leaving or being kicked archives a mesh instead of deleting it, so
  its seed survives. (#56)

## [0.1.8] - 2026-09-26

Published under the `release-0.1` dist-tag.

### Changed

- `autobee` 2.11.8, backported from 0.5.0, with the `strictReindex` that 0.4.0
  brought in. A mesh opened by 0.1.7 reindexes its views on first open.
  `hyperbee2` 2.18, `hypercore` 11.37, `corestore` 7.12.6, `hyperschema` 1.26.2
  and `hyperdb` 6.9; the wire format is unchanged. (#250)

## [0.1.7] - 2026-09-17

Published under the `release-0.1` dist-tag.

### Added

- `moveChat` and `moveChatGroup`, and groups nobody has arranged sort by name,
  backported from 0.2.0 and 0.2.2. See 0.2.0 for an example. (#44, #110)

## [0.1.6] - 2026-09-16

Published under the `release-0.1` dist-tag.

### Changed

- `@qvac/harness` 0.2.7.

### Fixed

- Every attached file gets a share of the retrieval budget, backported from
  0.2.1. (#64)

## [0.1.5] - 2026-09-15

### Added

- Joining through a fast-forward loads the device, agent, member and chat lists
  the app needs to start, so a cold join no longer stalls on "Requesting host
  setup". Nothing to call: it runs on every fast-forward. (#43)

### Fixed

- Mesh keys are derived from the `qvac-assistant/mesh` namespace again. Since
  0.1.0 a seed stored by the `qvac-assistant` package opened as a fresh, empty
  mesh with no error, and its chats, agents and groups were left behind on
  disk. They come back with this release. A mesh first created by 0.1.0 to
  0.1.4 derives differently here. (#59)
- After a few skill turns, the prompt could end on a tool turn, so the model
  narrated loading a skill or gave no answer. (#48)

## [0.1.4] - 2026-09-12

### Added

- `duck --help` and `duck --version`. Both answer without loading the engine.
  (#36)

  ```sh
  $ duck --version
  @qvac/core     0.1.4
  @qvac/harness  0.2.4
  @qvac/sdk      0.19.0
  ```

### Changed

- `duck` draws its first frame before loading the engine, and
  `QVAC_INPROCESS` is gone: `duck` runs the same sidecar topology as the
  desktop app. (#37)

### Fixed

- The README image on npm was broken, so `ducks.png` ships in the package
  again. (#36)

## [0.1.3] - 2026-09-12

### Removed

- **Breaking:** the `./dist/assistant.cjs` export. Nothing relocated the bundle
  this package published. A host that spawns Core from its own bundle stows
  `worker/assistant-sidecar.mjs` in its own build, as the desktop and mobile
  apps do, and passes the result as `entry`. (#33)

  ```js
  const engine = new AssistantClient({
    storagePath,
    device,
    entry: '/path/to/your/assistant.bundle'
  })
  ```

### Fixed

- 0.1.2 installed and then hung with no output: 14 of the 47 native addons
  outside the published bundle were at a different version from the ones the
  bundle was built with. `duck` now runs from the installed files, and the
  tarball shrinks from 11.9 MB to 517 KB. Requires `@qvac/harness` 0.2.4. (#33)

## [0.1.2] - 2026-09-11

### Added

- `duck`, the terminal app, ships in the package. It runs the same assistant
  sidecar that the desktop app ships. Joining a mesh is `/join` inside the app,
  not an argument at startup. `bare` has to be on your PATH. (#30)

  ```sh
  npm i -g @qvac/core
  duck
  ```

## [0.1.1] - 2026-09-11

### Added

- A `./wire-codec` export for the generated hyperschema messages, so a host can
  decode what the real decoder produces. (#28)

  ```js
  import { decode, encode } from '@qvac/core/wire-codec'

  const chunk = decode('@assistant/chunk', encode('@assistant/chunk', value))
  ```

### Fixed

- The compiled library could not load: eight modules in `dist-lib` imported
  `schema/helpers.js`, which was missing from the package. (#28)

## [0.1.0] - 2026-09-11

### Added

- First release as `@qvac/core`. It contains `Core`, `Client` and
  `QvacAssistant`, moved out of `qvac-app` with their history. The hosting
  contract and the schema codegen come from `@qvac/harness`. (#1, #4, #7, #11)

  ```js
  import { AssistantClient, QvacAssistant } from '@qvac/core'

  const engine = new AssistantClient({
    storagePath: '/path/to/state',
    device: { name: 'laptop', capabilityProfile: 'high', recommendedModelName: 'Qwen3.5-9B' }
  })
  await engine.ready()

  const assistant = new QvacAssistant(engine, harness)
  await assistant.ready()
  ```

[Unreleased]: https://github.com/tetherto/qvac-core/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/tetherto/qvac-core/compare/v0.10.4...v0.11.0
[0.10.4]: https://github.com/tetherto/qvac-core/compare/v0.10.3...v0.10.4
[0.10.3]: https://github.com/tetherto/qvac-core/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/tetherto/qvac-core/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/tetherto/qvac-core/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/tetherto/qvac-core/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/tetherto/qvac-core/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/tetherto/qvac-core/compare/v0.7.6...v0.8.0
[0.7.6]: https://github.com/tetherto/qvac-core/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/tetherto/qvac-core/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/tetherto/qvac-core/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/tetherto/qvac-core/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/tetherto/qvac-core/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/tetherto/qvac-core/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/tetherto/qvac-core/compare/v0.6.7...v0.7.0
[0.6.7]: https://github.com/tetherto/qvac-core/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/tetherto/qvac-core/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/tetherto/qvac-core/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/tetherto/qvac-core/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/tetherto/qvac-core/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/tetherto/qvac-core/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/tetherto/qvac-core/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/tetherto/qvac-core/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/tetherto/qvac-core/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/tetherto/qvac-core/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/tetherto/qvac-core/compare/v0.3.3...v0.4.0
[0.3.5]: https://github.com/tetherto/qvac-core/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/tetherto/qvac-core/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/tetherto/qvac-core/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/tetherto/qvac-core/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/tetherto/qvac-core/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/tetherto/qvac-core/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/tetherto/qvac-core/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/tetherto/qvac-core/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tetherto/qvac-core/compare/v0.1.5...v0.2.0
[0.1.8]: https://github.com/tetherto/qvac-core/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/tetherto/qvac-core/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/tetherto/qvac-core/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/tetherto/qvac-core/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/tetherto/qvac-core/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tetherto/qvac-core/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tetherto/qvac-core/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tetherto/qvac-core/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tetherto/qvac-core/releases/tag/v0.1.0
