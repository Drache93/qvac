import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import BlindPeering from 'blind-peering';
import Corestore from 'corestore';
import CorestoreStorage from 'hypercore-storage';
import { constants as RocksConstants } from 'rocksdb-native';
import path from 'path';
import Rache from 'rache';
import Hyperswarm from 'hyperswarm';
import Wakeup from 'protomux-wakeup';
import Top from 'process-top';
import ReadyGuard from 'ready-guard';
import ReadyResource from 'ready-resource';
import ScopeLock from 'scope-lock';
import { isAndroid } from 'which-runtime';
import { createApi } from './api/index.js';
import { writeAutoDownloadModels } from './api/app-config.js';
import { requireOurAdmin, requireWorkspace } from './api/members.js';
import { projectName } from './api/projects.js';
import { createServedApi } from './api/served.js';
import { departedMembers, isWorkspace, lastAdminAmongOthers, liveMemberIds, readMemberKey, upgradeMembers } from './core/contract/workspace.js';
import { readPublicSeed } from './core/contract/public-seeds.js';
import { openSealedToDevice, sealToDevice } from './core/device-seal.js';
import { removedBy } from './core/contract/invites.js';
import { meshKind } from './core/contract/mesh-kind.js';
import { WORKSPACES_RULES, bornUnderRules, rulesVersion } from './core/contract/mesh-rules.js';
import { inProject, listedProject, listsMember, liveMember, projectMember, projectOfGroup, readProjectKey, UNGROUPED } from './core/contract/projects.js';
import { requireMesh } from './api/current-mesh.js';
import { CoreError } from './errors.js';
import { ChatMoves } from './core/chat-move.js';
import { purgeCores } from './core/purge.js';
import { copyContent } from './core/chat-copy.js';
import { followAgentCopies, keepCopyChats } from './core/agent-copies.js';
import { followPickedAgents, followSharedAgents, liveSharedAgent, pickAgent, shareAgent, unpickAgent } from './core/shared-agents.js';
import { inRole, publicRoute } from './core/contract/roles.js';
import { freshPublicRecord, isOwnWorkspace, isPublicRecord, lostMint, onOwnSeed, leftPublicRecordKey, ownWorkspaceSeed, ownWorkspaces, publicMeshKey, publicRecordKey, publicSeed, servesAgents, servesChat, servesChunk } from './core/public-mesh.js';
import { memberBoxKeyPair, openSealedToMember } from './core/member-key.js';
import { dueProjectDeviceKeys, dueProjectHostKey, dueProjectKey } from './core/project-keys.js';
import { readProjectDeviceKey } from './core/contract/project-device-keys.js';
import { agentJoin, freshHostRecord, hostRecordKey, hostState, hostTargets, isHostRecord } from './core/agent-hosting.js';
import { hostForWriter } from './core/contract/model-requests.js';
import { asEncoded, watchModels } from './models-watch.js';
import { BLIND_PEER_KEYS, BLIND_PEERING_OFF_KEY, BLIND_RELAY_KEYS } from './core/blind-peers.js';
import { CoreBlobServer, MemoryVectorIndex } from './core/files/index.js';
import { removeChatAttachments, removeChatKnowledge } from './core/chat.js';
import { rebuildChatOrder, refreshChatOrder, retireGoneChats } from './core/chat-order.js';
import { createFsDriveHost } from './core/fs-drives.js';
import { sweepDriveStaging } from './fs-drive-bridge.js';
import { decodeMeshInvite, encodeMeshInvite } from './core/invite.js';
import { fileKeyOf, knownFile, referencedFile } from './core/files/local-index.js';
import { openLocalStore, recordedRole } from './core/local/index.js';
import { backgroundSyncKey } from './core/local/files.js';
import { FOLD_PENDING, GROUPS_PENDING, agentsFoldKey, groupBuckets, groupRecordKey, isGroupRecord, liveGroups, projectsByGroup, upgradeCheckedKey } from './core/workspace-upgrade.js';
import { foldAgents, ownCopies } from './core/upgrade-agents.js';
import { MAX_MESH_NAME_CHARS, meshNameWithinBounds } from '../schema/qvac.js';
import { rehomeAgents } from './core/agent.js';
import { countContents, migrateContents, withArchivedMesh } from './core/archived-mesh.js';
import { isMobilePlatform } from '@qvac/harness/lib/models/model-catalog.ts';
import { storeSkillSecret, syncSkillSecrets } from './core/skill-secrets.js';
import { SKILL_SECRET_PREFIX } from './core/contract/skill-secrets.js';
import { attestDeviceProof, attestMemberClaim, chainTo, claimAttestation, delegationFits, openIdentity, pairingAnchorSeed } from './core/identity.js';
import { openRecoveryCore, publishRecovery, readRecovery, recoveryKeys } from './core/account-recovery.js';
import { claimOwnMembership, legacyNameStamp, namedAt, renameFoundedMember } from './core/membership.js';
import { runMigrations } from './core/migrations/index.js';
import { backfillFileIndex } from './core/migrations/file-index.js';
import { advertiseDeviceVersion, retractInventory } from './core/devices.js';
import { DeviceControl } from './core/device-control.js';
import { forwardToDevices, servedToSiblings } from './api/device-routes.js';
import { OtaConfigReader, configCoreFor, resolveConfigChannel, vendoredMinSupportedVersion } from './core/ota-config.js';
import { updateRequired } from './core/min-version.js';
import { PendingDepartures, waitForDelivery } from './core/departures.js';
import { Mesh } from './core/mesh.js';
import { raceResource } from './race-resource.js';
import { createSystemInfoSampler } from './core/system-info.js';
import { projectSenders } from './core/senders.js';
import { settleOnClose } from '@qvac/harness/rpc';
import { openLocalSpec } from './spec-loader.js';
import { unref } from './unref.js';
import { local } from '../spec/index.js';
import { AGENT_USERS, CHUNKS, DEVICES, JOINED_MESHES, MEMBERS, MESH_BLIND_PEERS, MESH_SEEDS, PROJECTS } from './core/collections.js';
import { isOwnRevokedRow } from './core/helpers/index.js';
const QvacState = local.getEnum('@local/qvac-state');
const top = new Top();
const FILE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SWARM_KEYPAIR_NAME = 'qvac-swarm-keypair';
const QVAC_CORE_NAMESPACE = 'qvac-core';
const HELD_AGENTS_PREFIX = 'skill-values.held-agents';
const MESH_ID = /^[0-9a-f]{64}$/;
export const DEVICE_UNKNOWN = 'This device has no device details: pass `device` when creating Core';
const RECOVERY_WAIT_MS = 30_000;
const TOPIC_RETRY_MS = [1_000, 5_000, 15_000];
const MESH_DIED = 'the local database died';
const MESH_NOT_EMPTY = 'this mesh is not empty: everyone in it will see the newcomer arrive, and the newcomer replays the whole history of the mesh, including what earlier members wrote';
const INVITE_DHT_NODES_LIMIT = 3;
const INVITE_BLIND_PEERS_LIMIT = 3;
const DIAGNOSTICS_SAMPLE_MS = 2000;
export class Core extends ReadyResource {
    _storagePath;
    store;
    rootCorestore;
    storage;
    _ownsStore;
    _ownsSwarm;
    _ownsWakeup;
    local;
    state;
    _transport;
    _apiLifecycle;
    _log;
    _spec;
    _bootstrapNodes;
    _device;
    _app;
    _minSupportedVersion;
    _otaConfigCore;
    _otaConfig = null;
    _blindPeering = null;
    _configPeered = false;
    _blindPeeringOn = true;
    _blindPeeringListeners = new Set();
    _recoveryCore = null;
    _recoverySigner = null;
    _localDevice;
    _blindPeerKeys;
    _blindPeeringOpts;
    _fileGc;
    _syncPacing;
    _autoDownloadModels;
    _fileGcTimer = null;
    _fileGcRun = null;
    _topicRetry = null;
    _topicRefreshes = 0;
    _meshSeed;
    _meshKey;
    _additionalNodes;
    _listModels;
    _modelMemory = null;
    _deleteModel;
    _clearKvCache;
    _deleteChatKvCache;
    _compactChat;
    _modelCatalogWatch;
    _modelCatalogWatchSource = new ReadyGuard();
    _retryModelDownload;
    _transcribe;
    _detectLanguage;
    _previewModelSource;
    _speak;
    _speakStream;
    _embedder;
    _ragExtractors;
    _indexedEmbedder = null;
    _indexingLock = new ScopeLock();
    _embedBatches = new ScopeLock();
    _indexingDevice = {
        mobile: () => isMobilePlatform(this._localDevice?.platform ?? ''),
        peers: () => this.peerDeviceIds
    };
    _meshTransitionLock = new ScopeLock();
    _opening = new Map();
    _retiring = new Map();
    _debugBeforeMeshOpen;
    _debugOnMeshOpened;
    _skills;
    _skillCatalog;
    _skillManagement;
    _catalogHooks = new ReadyGuard();
    _tools;
    _hostsModelSource;
    _spareVectorIndex;
    _closeSignal;
    _signalClose;
    _closeListeners;
    _closeSignaled;
    _meshes;
    _accountId;
    _offlineBoot = new ReadyGuard();
    onlineBoot = new ReadyGuard();
    _candidateMesh;
    _cancelCandidateJoin;
    _joinCancellation;
    _rpcs = new Set();
    _stream;
    _api;
    _assistantApi = null;
    _chatMoves = null;
    _clients;
    _deviceKeyPair;
    _identityPhrase = null;
    _identityPublicKey = null;
    _swarm;
    _onSwarmConnection;
    _departures = null;
    _fsDrives = null;
    _blobServer = null;
    _wakeup;
    _following = new Map();
    _kickedProjects = new Map();
    _upgrading = new Set();
    _groupPasses = new WeakSet();
    _groupPassesDue = new WeakSet();
    _purging = new Map();
    _publicIds = new Map();
    _meshNames = new Map();
    _ownWorkspaceId = null;
    _publicWriters = new WeakMap();
    _leftPublic = new WeakSet();
    _publicWaiters = new Set();
    _publicFollow = new ScopeLock({ debounce: true });
    _publicMerges = new Map();
    _publicCarries = new Map();
    _ownCarries = new Map();
    _publicMigration = null;
    _agentCopies = new ScopeLock({ debounce: true });
    _sharedAgents = new ScopeLock({ debounce: true });
    _memberKeyWrites = new WeakMap();
    _projectKeySeals = new ScopeLock({ debounce: true });
    _hosting = new ScopeLock({ debounce: true });
    _skillSecrets = new ScopeLock({ debounce: true });
    _hostMeshes = new Set();
    _hostJoins = new WeakMap();
    _agentListeners = new Set();
    _revokingInMeshes = null;
    _revokeInMeshesAgain = false;
    _sweepUnknownEverywhere = false;
    _sweepUnknownIn = new Set();
    _minting;
    _backfill = Promise.resolve();
    _leaving;
    _kicked;
    _kickedPending;
    _peers;
    _peerArrivedSuspended = false;
    _statusListeners;
    _senderListeners;
    _listing;
    _diagnosticsProviders;
    _inferenceCalls = null;
    _modelResidency = null;
    _modelUsers = null;
    _deviceControl;
    _servedToSiblings;
    _systemInfo;
    _statusError;
    _upgradeRequired;
    constructor(transport, { storagePath, store = undefined, swarm = undefined, wakeup = undefined, logger = null, spec = openLocalSpec, bootstrapNodes = undefined, device = undefined, app = undefined, minSupportedVersion = undefined, otaConfigCore = undefined, blindPeerKeys = undefined, blindPeeringOpts = undefined, fileGc = null, autoDownloadModels = undefined, meshSeed = undefined, meshKey = undefined, additionalNodes = undefined, listModels = undefined, deleteModel = undefined, clearKvCache = undefined, deleteChatKvCache = undefined, compactChat = undefined, modelCatalogWatch = undefined, retryModelDownload = undefined, transcribe = undefined, detectLanguage = undefined, previewModelSource = undefined, speak = undefined, speakStream = undefined, embedder = undefined, extractors = undefined, skills = undefined, skillCatalog = undefined, tools = undefined, hostsModelSource = false, vectorIndex = undefined, apiLifecycle = undefined, syncBatch = undefined, syncPauseMs = undefined }) {
        super();
        this._transport = transport;
        this._apiLifecycle = apiLifecycle ?? {
            suspend: () => this.suspend(),
            resume: () => this.resume()
        };
        this._log = logger;
        if (swarm && (!store || !wakeup)) {
            throw new Error('swarm may only be passed alongside store and wakeup');
        }
        this._ownsStore = !store;
        this._ownsSwarm = !swarm;
        this._ownsWakeup = !wakeup;
        this._storagePath = storagePath;
        this.storage = new CorestoreStorage(this._storagePath, {
            blobGarbageCollectionAgeCutOff: 1.0,
            blobGarbageCollectionForceThreshold: 0.5,
            blobFileSize: 64 * 1024 * 1024
        });
        this.rootCorestore = store ?? new Corestore(this.storage, { globalCache: new Rache() });
        this.store = this.rootCorestore.namespace(QVAC_CORE_NAMESPACE);
        this.local = openLocalStore(this.storage);
        this.state = QvacState.RESUME;
        this._spec = spec;
        this._bootstrapNodes = bootstrapNodes;
        this._device = device;
        this._app = app;
        this._minSupportedVersion = minSupportedVersion;
        const channel = resolveConfigChannel(app?.channel);
        const lane = channel ? configCoreFor(channel) : null;
        this._otaConfigCore = minSupportedVersion ? null : (otaConfigCore ?? lane);
        if (!minSupportedVersion) {
            this._minSupportedVersion = vendoredMinSupportedVersion();
        }
        this._localDevice = null;
        this._blindPeerKeys = blindPeerKeys;
        this._blindPeeringOpts = blindPeeringOpts;
        this._fileGc = fileGc;
        this._syncPacing = { syncBatch, syncPauseMs };
        this._autoDownloadModels = autoDownloadModels;
        this._meshSeed = meshSeed;
        this._meshKey = meshKey;
        this._additionalNodes = additionalNodes;
        this._listModels = listModels ?? null;
        this._deleteModel = deleteModel ?? null;
        this._clearKvCache = clearKvCache ?? null;
        this._deleteChatKvCache = deleteChatKvCache ?? null;
        this._compactChat = compactChat ?? null;
        this._modelCatalogWatch = modelCatalogWatch ?? null;
        this._openModelCatalogWatchSource();
        void this._modelCatalogWatchSource.ready().catch(noop);
        this._retryModelDownload = retryModelDownload ?? null;
        this._transcribe = transcribe ?? null;
        this._detectLanguage = detectLanguage ?? null;
        this._previewModelSource = previewModelSource ?? null;
        this._speak = speak ?? null;
        this._speakStream = speakStream ?? null;
        this._embedder = embedder ?? null;
        this._ragExtractors = extractors;
        this._skills = skills ?? null;
        this._skillCatalog = skillCatalog ?? null;
        this._skillManagement = null;
        this._tools = tools ?? null;
        this._hostsModelSource = hostsModelSource;
        this._openCatalogHooks();
        void this._catalogHooks.ready().catch(noop);
        this._spareVectorIndex = vectorIndex ?? (embedder ? new MemoryVectorIndex() : null);
        const closeSignal = Promise.withResolvers();
        this._closeSignal = closeSignal.promise;
        this._signalClose = closeSignal.resolve;
        this._closeListeners = new Set();
        this._closeSignaled = false;
        void this._closeSignal.then(() => {
            this._closeSignaled = true;
            const listeners = [...this._closeListeners];
            this._closeListeners.clear();
            for (const listener of listeners) {
                listener();
            }
        });
        this._meshes = new Map();
        this._accountId = null;
        this._candidateMesh = null;
        this._cancelCandidateJoin = null;
        this._joinCancellation = null;
        this._rpcs.clear();
        this._stream = null;
        this._api = null;
        this._clients = new Set();
        this._deviceKeyPair = null;
        this._swarm = swarm ?? null;
        this._onSwarmConnection = (conn) => this._onConnection(conn);
        this._wakeup = wakeup ?? new Wakeup();
        this._deviceControl = new DeviceControl({
            allowed: (deviceId) => this._isOwnLiveDevice(b4a.from(deviceId)),
            served: () => this._servedToSiblings
        });
        this._servedToSiblings = null;
        this._minting = false;
        this._leaving = null;
        this._kicked = false;
        this._kickedPending = false;
        this._peers = new Map();
        this._statusListeners = new Set();
        this._senderListeners = new Set();
        this._listing = null;
        this._diagnosticsProviders = new Set();
        this._systemInfo = null;
        this._statusError = null;
        this._upgradeRequired = null;
    }
    get devicePublicKey() {
        return this._deviceKeyPair?.publicKey ?? null;
    }
    _requireDeviceKeyPair() {
        if (!this._deviceKeyPair) {
            throw new Error('device key pair read before the offline boot');
        }
        return this._deviceKeyPair;
    }
    get fsDrives() {
        return this._fsDrives;
    }
    get suspended() {
        return this.state === QvacState.SUSPEND;
    }
    get mesh() {
        return this._accountMesh();
    }
    async meshReady() {
        await this._awaitMesh();
    }
    get peerCount() {
        return this._peers.size;
    }
    get peerDeviceIds() {
        const ids = [...this._peers.keys()].map((conn) => b4a.toHex(conn.remotePublicKey));
        return [...new Set(ids)].sort();
    }
    async _open() {
        this._runBootOffline().catch(noop);
        this._runBootOnline().catch(noop);
        await this._offlineBoot.ready();
        this._log?.info('lifecycle', 'core open');
    }
    async _runBootOffline() {
        try {
            this._deviceKeyPair =
                this._swarm?.keyPair ?? (await this.store.createKeyPair(SWARM_KEYPAIR_NAME));
            this._identityPublicKey = (await this.local.readIdentity())?.publicKey ?? null;
            this._blindPeeringOn = (await this.local.get(BLIND_PEERING_OFF_KEY)) !== true;
            this._localDevice = await this.local.ensureDevice(this._deviceKeyPair.publicKey, this._device);
            await this.local.dropLeftMeshes();
            await this._retireComputeMeshes();
            for (const row of await this.local.meshNames()) {
                this._meshNames.set(b4a.toHex(row.meshKey), row);
            }
            this._resumePurges().catch((err) => this._log?.warn(['p2p', 'mesh'], 'reading the interrupted purges failed', err));
            if (this._autoDownloadModels !== undefined) {
                await writeAutoDownloadModels(this.local, this._autoDownloadModels);
            }
            const swarm = this._openSwarm(this._deviceKeyPair);
            this._departures = new PendingDepartures(this.store, this.local, {
                swarm,
                isPooled: (key) => this._pooled(b4a.toHex(key)) !== null,
                deviceId: () => this._deviceKeyPair?.publicKey ?? null,
                logger: this._log,
                blindPeerKeys: this._resolveBlindPeerKeys(),
                blindPeering: () => this._blindPeeringClient(),
                wakeup: this._wakeup,
                delivered: (key) => void this._finishHeldPurge(key)
            });
            this._fsDrives = createFsDriveHost(this.store, {
                swarm,
                blindPeerKeys: this._resolveBlindPeerKeys(),
                blindPeering: () => this._blindPeeringClient()
            });
            void sweepDriveStaging();
            void this.local.runLogs
                .sweep()
                .catch((err) => this._log?.warn('core', 'run log sweep failed', { err }));
            this._blobServer = new CoreBlobServer(this.store, (coreKey, blockOffset, meshKey) => this._meshForBlobCore(coreKey, blockOffset, meshKey), { onRead: (mesh, coreKey, blockOffset) => this._servedFile(mesh, coreKey, blockOffset) });
            this._blobServer.on('rebound', (port) => {
                this._log?.warn('core', 'blob server rebound, links minted before now are stale', { port });
            });
            await this._blobServer.ready();
            await this._openOtaConfig();
            await this._openBootMesh();
            this._systemInfo = createSystemInfoSampler(this._log);
            const meshStatus = this._meshStatusSource();
            const deviceId = this.devicePublicKey;
            this._chatMoves = deviceId
                ? new ChatMoves((meshId) => requireMesh(this._meshPool(), meshId, { route: 'put-chat' }), this.local, {
                    deviceId,
                    log: this._log,
                    account: () => this._accountMesh(),
                    agents: this._agentPicks()
                })
                : null;
            const api = createApi({
                state: this.local,
                mesh: this._meshPool(),
                meshAlias: {
                    keyOf: (meshId) => b4a.from(this._publicIdOf(meshId) ?? meshId, 'hex'),
                    idOf: (meshKey) => this._workspaceOfPublic(b4a.toHex(meshKey))
                },
                meshStatus,
                accountMesh: () => this._accountMesh(),
                agentPicks: this._agentPicks(),
                agentCopiesKept: (agent) => this._keepAgentCopies(agent),
                agentChanged: async (agentId) => {
                    await this._followAgentCopies(agentId);
                    await this._followSharedAgents();
                },
                accountAgents: {
                    watch: (listener) => void this._agentListeners.add(listener),
                    unwatch: (listener) => void this._agentListeners.delete(listener)
                },
                network: this._networkStatusSource(),
                blindPeering: this._blindPeeringSource(),
                diagnostics: this._diagnosticsSource(),
                inferenceCalls: {
                    list: (meshId, chatId) => this._listInferenceCalls(meshId, chatId),
                    forget: async (chatId) => void (await this._inferenceCalls?.forget(chatId))
                },
                logs: this._logSource(),
                log: this._log,
                chatMoves: this._chatMoves,
                senders: {
                    lookup: (meshId) => this._chatSenders(meshId),
                    changes: {
                        watch: (listener) => void this._senderListeners.add(listener),
                        unwatch: (listener) => void this._senderListeners.delete(listener)
                    }
                },
                deviceId: this.devicePublicKey,
                lifecycle: this._apiLifecycle,
                ragIndex: (meshId) => this._meshes.get(this._publicIdOf(meshId) ?? meshId)?.vectorIndex ?? null,
                ragEmbed: () => this._indexedEmbedder,
                platform: () => this._localDevice?.platform ?? null,
                deletedProject: (projectId) => this._projectGone(projectId),
                projectOf: (workspaceKey, projectKey) => this._isProjectOf(workspaceKey, projectKey),
                nameOf: (projectKey) => {
                    const id = b4a.toHex(projectKey);
                    return this._pooled(id)?.name ?? this._meshNames.get(id) ?? null;
                },
                workspaceOf: async (projectId) => {
                    const key = (await this.local.readMeshSession(this._meshKeyOf(projectId)))?.workspaceKey;
                    const workspaceId = key ? b4a.toHex(key) : null;
                    return workspaceId === this._ownWorkspaceId ? null : workspaceId;
                },
                pushSkillSecret: (request) => this.pushSkillSecret(request),
                onConfigSet: (key) => {
                    if (key.startsWith(SKILL_SECRET_PREFIX)) {
                        void this._followSkillSecrets();
                    }
                },
                storageRoot: path.dirname(this._storagePath),
                listModels: this._hostsModelSource || this._listModels
                    ? async (request) => (await this._readModelList(request)) ?? { models: [] }
                    : null,
                deleteModel: this._hostsModelSource || this._deleteModel
                    ? (options) => this._deleteModel?.(options) ??
                        Promise.resolve({ name: options.name, removed: 0, freedBytes: 0 })
                    : null,
                loadModel: this._hostsModelSource
                    ? ({ name }) => this._modelResidency?.load(name) ??
                        Promise.reject(new CoreError('MODEL_RUNTIME_UNBOUND'))
                    : null,
                unloadModel: this._hostsModelSource
                    ? ({ name }) => this._modelResidency?.unload(name) ??
                        Promise.reject(new CoreError('MODEL_RUNTIME_UNBOUND'))
                    : null,
                modelUsers: this._hostsModelSource
                    ? ({ name }) => this._modelUsers?.(name) ?? Promise.reject(new CoreError('MODEL_RUNTIME_UNBOUND'))
                    : null,
                clearKvCache: () => this._clearKvCache?.() ??
                    Promise.resolve({
                        status: 'unsupported',
                        error: 'No harness KV cache deletion source is bound'
                    }),
                deleteChatKvCache: (chatId) => this._deleteChatKvCache?.(chatId) ??
                    Promise.resolve({
                        status: 'unsupported',
                        error: 'No harness KV cache deletion source is bound'
                    }),
                compactChat: (chatId, meshId) => this._compactChat?.(chatId, meshId) ??
                    Promise.resolve({ compacted: false, reason: 'unsupported' }),
                modelCatalogWatch: this._hostsModelSource || this._modelCatalogWatch
                    ? () => this._watchModelCatalog()
                    : null,
                modelsWatch: this._hostsModelSource || this._modelCatalogWatch
                    ? (request) => watchModels(() => this._modelCatalogRevisions(), () => this._readModelList(request))
                    : null,
                retryModelDownload: this._hostsModelSource || this._retryModelDownload
                    ? ({ name }) => this._retryModelDownload?.(name) ??
                        Promise.reject(new CoreError('CAPABILITY_UNBOUND', ['model download source']))
                    : null,
                transcribe: this._hostsModelSource || this._transcribe
                    ? (request) => this._transcribe?.(request) ??
                        Promise.reject(new CoreError('CAPABILITY_UNBOUND', ['transcription source']))
                    : null,
                detectLanguage: this._hostsModelSource || this._detectLanguage
                    ? (request) => this._detectLanguage?.(request) ??
                        Promise.reject(new CoreError('CAPABILITY_UNBOUND', ['language detector']))
                    : null,
                previewModelSource: (request) => this._previewModelSource?.(request) ??
                    Promise.reject(new CoreError('CAPABILITY_UNBOUND', ['model source preview'])),
                speak: this._hostsModelSource || this._speak
                    ? (request) => this._speak?.(request) ??
                        Promise.reject(new CoreError('CAPABILITY_UNBOUND', ['tts source']))
                    : null,
                speakStream: this._hostsModelSource || this._speakStream
                    ? (text) => {
                        if (!this._speakStream) {
                            throw new CoreError('CAPABILITY_UNBOUND', ['tts source']);
                        }
                        return this._speakStream(text);
                    }
                    : null,
                deviceHost: {
                    removeWriter: (writerKey, deviceId, mesh) => this.removeDeviceWriter(writerKey, deviceId, mesh),
                    renameLocal: (name) => this.renameLocalDevice(name),
                    saveProfileLocal: (capabilityProfile, recommendedModelName, platform) => this.saveDeviceProfileLocal(capabilityProfile, recommendedModelName, platform),
                    readLocalProfile: () => this._localDevice
                        ? {
                            capabilityProfile: this._localDevice.capabilityProfile,
                            recommendedModelName: this._localDevice.recommendedModelName,
                            platform: this._localDevice.platform
                        }
                        : null,
                    isAccount: (mesh) => this._isAccount(mesh)
                },
                skills: this._hostsModelSource || this._skills
                    ? (agentId, modelName, options) => this._skills?.(agentId, modelName, options) ?? Promise.resolve([])
                    : null,
                skillCatalog: this._hostsModelSource || this._skillCatalog
                    ? async (agentId, modelName, options) => {
                        await this._waitForCatalogHooks();
                        return (this._skillCatalog?.(agentId, modelName, options) ??
                            Promise.resolve({ skills: [] }));
                    }
                    : null,
                tools: this._hostsModelSource || this._tools
                    ? async () => {
                        await this._waitForCatalogHooks();
                        return this._tools?.() ?? Promise.resolve({ tools: [] });
                    }
                    : null,
                listManagedSkills: this._hostsModelSource || this._skillManagement
                    ? async () => ({
                        skills: [...((await this._runLocalSkillOverlayOp({ op: 'list' })).skills ?? [])]
                    })
                    : null,
                readSkillFile: this._hostsModelSource || this._skillManagement
                    ? async (name) => {
                        const res = await this._runLocalSkillOverlayOp({ op: 'read', name });
                        return { found: res.found ?? false, content: res.content, origin: res.origin };
                    }
                    : null,
                writeSkillFile: this._hostsModelSource || this._skillManagement
                    ? async (name, content) => ({
                        ok: (await this._runLocalSkillOverlayOp({ op: 'write', name, content })).ok ?? false
                    })
                    : null,
                copySkillForEdit: this._hostsModelSource || this._skillManagement
                    ? async (name) => ({
                        copied: (await this._runLocalSkillOverlayOp({ op: 'copy', name })).copied ?? false
                    })
                    : null,
                deleteOverlaySkill: this._hostsModelSource || this._skillManagement
                    ? async (name) => ({
                        removed: (await this._runLocalSkillOverlayOp({ op: 'delete', name })).removed ?? false
                    })
                    : null
            });
            this._servedToSiblings = servedToSiblings(api);
            this._api = {
                ...api,
                ...forwardToDevices(api, {
                    deviceId: this._requireDeviceKeyPair().publicKey,
                    remote: (deviceId) => this._deviceControl.engine(deviceId)
                })
            };
            this._assistantApi = {
                ...this._api,
                ...createServedApi({
                    pool: this._servedPool(),
                    local: this._api,
                    foreign: (meshId) => {
                        const pooled = this._pooled(meshId);
                        return !!pooled && this._isForeign(pooled);
                    },
                    status: meshStatus,
                    list: () => this._servedMeshList(),
                    deviceId: this.devicePublicKey,
                    log: this._log
                })
            };
            this._stream = await this._transport();
            const { bindApi, HRPC } = await this._spec();
            const rpc = settleOnClose(new HRPC(this._stream));
            bindApi(rpc, this._api);
            this._rpcs.add(rpc);
            this._offlineBoot.exit();
            void this._pushIdentityPhrase();
            this._chatMoves
                ?.resume()
                .catch((err) => this._log?.warn('chat-move', 'unfinished moves not resumed', { err }));
            return;
        }
        catch (err) {
            try {
                this._systemInfo?.destroy();
                this._systemInfo = null;
                await this._stopIndexing();
                await this._closeOtaConfig();
                await this._fsDrives?.close();
                this._fsDrives = null;
                await this._blobServer?.close();
                this._blobServer = null;
                await this._departures?.close();
                this._departures = null;
                this._log?.info('core', 'closing swarm');
                await this._closeSwarm();
                this._log?.info('core', 'closing local');
                await this.local?.close();
                this._log?.info('core', 'closing mesh');
                for (const { mesh } of this._meshes.values()) {
                    await mesh.close();
                }
                this._log?.info('core', 'closing storage');
                await this._closeStore();
            }
            finally {
                this._offlineBoot.destroy(err instanceof Error ? err : new Error(String(err)));
            }
        }
    }
    async _openBootMesh() {
        if (this._blockedByMinVersion() || this._accountMesh() || this._minting) {
            return;
        }
        try {
            const mesh = await this._switchToMesh({
                seed: this._meshSeed,
                baseKey: this._meshKey,
                account: true
            });
        }
        catch (err) {
            if (this.closing) {
                return;
            }
            if (!this._upgradeRequired) {
                this._statusError = statusErrorMessage('opening the local database failed', err);
            }
            this._notifyStatus();
            this._log?.error(['p2p', 'mesh'], 'mesh open failed', err);
        }
    }
    async _retireComputeMeshes() {
        for (const row of await this.local.listMeshes()) {
            if (row.compute) {
                await this._teardownMesh(row.key);
            }
        }
        await this.local.deletePrefix(HELD_AGENTS_PREFIX);
    }
    async _runBootOnline() {
        void this.onlineBoot.ready().catch(noop);
        try {
            await this._offlineBoot.ready();
            if (this.closing) {
                return;
            }
            const mesh = this._accountMesh();
            if (mesh) {
                this._bringMeshOnline(mesh);
            }
            void this._openUpgradable();
        }
        catch (err) {
            if (this.closing) {
                return;
            }
            this._log?.error(['p2p', 'mesh'], 'online boot failed', err);
        }
        finally {
            if (!this.closing && !this._offlineBoot.destroyed) {
                this._peerConfigCore();
            }
            if (!this.closing) {
                this._departures?.flush();
            }
            if (!this.closing) {
                this._startFileGc({ now: true });
            }
            this.onlineBoot.exit();
        }
    }
    async _reopenMesh() {
        try {
            if (this.closing || this._accountMesh() || this._minting) {
                return;
            }
            await this._startMesh({ seed: this._meshSeed, baseKey: this._meshKey, account: true });
        }
        catch (err) {
            if (this.closing) {
                return;
            }
            if (!this._upgradeRequired) {
                this._statusError = statusErrorMessage('reopening the local database failed', err);
            }
            this._notifyStatus();
            this._log?.error(['p2p', 'mesh'], 'reopening the mesh failed', err);
        }
    }
    get otaConfigCore() {
        return this._otaConfigCore;
    }
    async _openOtaConfig() {
        const core = this._otaConfigCore;
        if (!core) {
            this._log?.warn(['p2p', 'config'], 'no release lane: the version floor is inert', {
                lane: this._app?.channel ?? null,
                appVersion: this._app?.version ?? null
            });
            return;
        }
        if (this._otaConfig || this.closing) {
            return;
        }
        const config = new OtaConfigReader(this.store, core);
        this._otaConfig = config;
        try {
            if (!(await recordedBlockIsLocal(config.core))) {
                this._log?.warn(['p2p', 'config'], 'lane core records a block it does not hold: the baked floor stands');
                await this._closeOtaConfig();
                return;
            }
            await config.ready();
            if (this.closing) {
                return;
            }
            config.on('update', () => {
                this._logFloor(config, 'updated');
                this.setMinSupportedVersion(config.minSupportedVersion);
            });
            this._logFloor(config, 'opened');
            this.setMinSupportedVersion(config.minSupportedVersion);
        }
        catch (err) {
            this._log?.warn(['p2p', 'config'], 'ota config unavailable', err);
        }
    }
    _logFloor(config, event) {
        const floor = config.minSupportedVersion;
        const appVersion = this._app?.version;
        const length = config.core.length;
        this._log?.info(['p2p', 'config'], `ota config ${event}`, {
            lane: this._app?.channel ?? null,
            discoveryKey: b4a.toHex(config.core.discoveryKey).slice(0, 8),
            length,
            floor,
            source: length > 0 && length >= (this._otaConfigCore?.minLength ?? 1) ? 'published' : 'vendored',
            appVersion: appVersion ?? null,
            withheld: updateRequired({ range: floor, appVersion })
        });
    }
    _peerConfigCore() {
        const config = this._otaConfig;
        const peering = this._blindPeeringClient();
        if (!config || !peering || this._configPeered) {
            return;
        }
        const keys = this._resolveBlindPeerKeys();
        if (keys.length === 0) {
            return;
        }
        this._configPeered = true;
        peering.addCoreBackground(config.core, { keys, pick: keys.length });
        this._log?.info(['p2p', 'config'], 'blind peering the config core');
    }
    _blindPeeringClient() {
        if (!this._swarm || !this._blindPeeringOn || this.closing) {
            return null;
        }
        if (this._blindPeering) {
            return this._blindPeering;
        }
        const peering = new BlindPeering(this._swarm.dht, this.store, {
            pick: 2,
            suspended: this.suspended,
            wakeup: this._wakeup,
            ...this._blindPeeringOpts
        });
        this._blindPeering = peering;
        return peering;
    }
    async _closeOtaConfig() {
        const config = this._otaConfig;
        this._otaConfig = null;
        await closeConfigReader(config);
    }
    _blockedByMinVersion() {
        const range = this._minSupportedVersion;
        const appVersion = this._app?.version;
        if (!updateRequired({ range, appVersion })) {
            if (this._upgradeRequired === 'floor') {
                this._setUpgradeRequired(null);
            }
            return false;
        }
        if (this._upgradeRequired) {
            return true;
        }
        this._log?.error(['p2p', 'mesh'], 'mesh requires a newer build - not opening', {
            range,
            appVersion
        });
        this._setUpgradeRequired('floor');
        return true;
    }
    _setUpgradeRequired(reason) {
        if (this._upgradeRequired === reason)
            return;
        this._upgradeRequired = reason;
        this._notifyStatus();
    }
    setMinSupportedVersion(required) {
        const next = required || undefined;
        if (this._minSupportedVersion === next) {
            return;
        }
        this._minSupportedVersion = next;
        if (this.closing) {
            return;
        }
        const withheld = this._upgradeRequired === 'floor';
        if (!this._blockedByMinVersion()) {
            if (withheld) {
                void this._reopenMesh();
            }
            return;
        }
        for (const { mesh } of [...this._meshes.values()]) {
            this._retirePooledMesh(mesh).catch((err) => {
                this._log?.warn(['p2p', 'mesh'], 'retiring a mesh above our floor failed', err);
            });
        }
        this._notifyStatus();
    }
    async connect(stream, { assistant = false } = {}) {
        if (!this.opened)
            await this.ready();
        const api = assistant ? this._assistantApi : this._api;
        if (this.closing || !api) {
            throw new CoreError('CORE_CLOSING');
        }
        const { bindApi, HRPC } = await this._spec();
        const rpc = settleOnClose(new HRPC(stream));
        bindApi(rpc, api);
        this._rpcs.add(rpc);
        this._clients.add(stream);
        void this._pushIdentityPhrase();
        stream.on('close', () => {
            this._clients.delete(stream);
            this._rpcs.delete(rpc);
        });
    }
    async wakeup() {
        if (this.closing)
            return;
        this.state = QvacState.WAKEUP;
        this._log?.info('core', 'wakeup');
        if (!this.opened) {
            await this.ready();
        }
        await this.resume();
    }
    async presuspend() {
        if (this.closing)
            return;
        this.state = QvacState.PRESUSPEND;
        this._log?.info('core', 'presuspend');
        if (!this.opened) {
            await this.ready();
        }
    }
    async suspend() {
        this._log?.info('core', 'suspend called');
        if (this.state === QvacState.SUSPEND) {
            return;
        }
        if (this.closing) {
            return;
        }
        this.state = QvacState.SUSPEND;
        if (!this.opened) {
            await this.ready();
        }
        this._log?.info('core', 'suspending');
        await this._stopFileGc();
        this._stopTopicRetry();
        for (const { mesh } of this._meshes.values()) {
            await mesh.suspend();
        }
        if (this._departures) {
            await this._departures.suspend();
        }
        await this._blindPeering?.suspend();
        if (this._swarm && this._ownsSwarm) {
            await this._swarm.suspend();
        }
        if (this._blobServer) {
            await this._blobServer.suspend();
        }
        if (!isAndroid) {
            await this.storage.suspend();
        }
        this._log?.info('lifecycle', 'core suspend');
    }
    async resume() {
        this._log?.info('core', 'resume called');
        if (this.state === QvacState.RESUME) {
            return;
        }
        if (this.closing) {
            return;
        }
        if (this.state === QvacState.PRESUSPEND) {
            this.state = QvacState.RESUME;
            return;
        }
        this.state = QvacState.RESUME;
        if (!this.opened) {
            await this.ready();
        }
        this._log?.info('core', 'resuming');
        await this.storage.resume();
        if (this._blobServer) {
            await this._blobServer.resume();
        }
        if (this._swarm && this._ownsSwarm) {
            await this._swarm.resume();
        }
        await this._blindPeering?.resume();
        for (const { mesh } of this._meshes.values()) {
            await mesh.resume();
        }
        if (this._departures) {
            await this._departures.resume();
        }
        this._departures?.flush();
        if (this._peerArrivedSuspended) {
            this._peerArrivedSuspended = false;
            for (const entry of this._meshes.values()) {
                this._retryOnPeer(entry);
            }
        }
        this._startFileGc();
        if (this._swarm) {
            void this._refreshTopics(this._swarm).catch(noop);
        }
        void this._pushIdentityPhrase();
        this._log?.info('lifecycle', 'core resume');
    }
    async _refreshTopics(swarm) {
        const run = ++this._topicRefreshes;
        let topics = 0;
        const failed = new Set();
        for (const discovery of this._joinedTopics(swarm)) {
            await discovery.flushed();
            if ((await discovery.refresh().catch(() => false)) === false) {
                failed.add(b4a.toHex(discovery.topic));
            }
            topics++;
        }
        this._log?.info(['p2p', 'swarm'], 'topics refreshed after resume', {
            topics,
            failed: failed.size,
            peers: this.peerDeviceIds.length
        });
        this._retryTopics(swarm, { run, failed, attempt: 0 });
    }
    _retryTopics(swarm, { run, failed, attempt }) {
        const delay = TOPIC_RETRY_MS.at(attempt);
        if (run !== this._topicRefreshes || failed.size === 0 || delay === undefined) {
            return;
        }
        this._topicRetry = setTimeout(() => {
            this._topicRetry = null;
            if (run !== this._topicRefreshes || !swarm.dht.online) {
                return;
            }
            void this._refreshFailed(swarm, failed).then((left) => {
                this._retryTopics(swarm, { run, failed: left, attempt: attempt + 1 });
            });
        }, delay * (0.75 + Math.random() / 2));
        unref(this._topicRetry);
    }
    async _refreshFailed(swarm, failed) {
        const left = new Set();
        for (const discovery of this._joinedTopics(swarm)) {
            const topic = b4a.toHex(discovery.topic);
            if (!failed.has(topic)) {
                continue;
            }
            if ((await discovery.refresh().catch(() => false)) === false) {
                left.add(topic);
            }
        }
        return left;
    }
    _stopTopicRetry() {
        this._topicRefreshes++;
        if (this._topicRetry) {
            clearTimeout(this._topicRetry);
            this._topicRetry = null;
        }
    }
    _joinedTopics(swarm) {
        if (this._ownsSwarm) {
            return swarm.topics();
        }
        const meshes = [...this._meshes.values()].map(({ mesh }) => mesh);
        if (this._candidateMesh) {
            meshes.push(this._candidateMesh);
        }
        return meshes
            .map((mesh) => swarm.status(mesh.discoveryKey))
            .filter((discovery) => discovery !== null);
    }
    async _close() {
        this._log?.info('core', 'closing');
        if (this.state === QvacState.SUSPEND) {
            await this.storage.resume();
        }
        this._servedToSiblings = null;
        this._deviceControl.destroy();
        this._catalogHooks.destroy(new CoreError('CORE_CLOSING'));
        this._modelCatalogWatchSource.destroy(new CoreError('CORE_CLOSING'));
        this._offlineBoot.destroy(new CoreError('CORE_CLOSING'));
        this.onlineBoot.destroy(new CoreError('CORE_CLOSING'));
        this._signalClose();
        this._notifyStatus();
        await this._stopFileGc();
        this._stopTopicRetry();
        if (this._stream) {
            this._stream.destroy();
        }
        for (const client of this._clients) {
            client.destroy();
        }
        this._clients.clear();
        await this._stopIndexing();
        await this._blobServer?.close();
        this._blobServer = null;
        await this._chatMoves?.close();
        this._chatMoves = null;
        for (const entry of this._meshes.values()) {
            this._unwireMesh(entry);
            await entry.mesh.close();
        }
        await this._discardCandidateMesh();
        await this._departures?.close();
        this._departures = null;
        await this._closeRecovery();
        await this._closeBlindPeering();
        await this._closeOtaConfig();
        await this._fsDrives?.close();
        this._fsDrives = null;
        this._log?.info('core', 'closing swarm');
        await this._closeSwarm();
        this._meshes.clear();
        this._accountId = null;
        this._log?.info('core', 'closing local');
        await this.local?.close();
        this._systemInfo?.destroy();
        this._systemInfo = null;
        this._log?.info('core', 'closing storage');
        await this._closeStore();
        this._log?.info('lifecycle', 'core closed');
    }
    async _closeStore() {
        await this.store?.close();
        if (this._ownsStore) {
            await this.rootCorestore?.close();
        }
        await this.storage.close();
    }
    _openSwarm(keyPair) {
        this._swarm ??= new Hyperswarm({
            keyPair,
            bootstrap: this._bootstrapNodes,
            relayThrough: this._bootstrapNodes ? undefined : () => BLIND_RELAY_KEYS
        });
        this._swarm.on('connection', this._onSwarmConnection);
        for (const conn of this._swarm.connections) {
            if (isPeerConnection(conn)) {
                this._onConnection(conn);
            }
        }
        this._log?.info(['p2p', 'swarm'], 'swarm opened', {
            deviceKey: b4a.toHex(keyPair.publicKey).slice(0, 8)
        });
        for (const node of this._additionalNodes ?? []) {
            this._swarm.dht.addNode(node);
        }
        return this._swarm;
    }
    _resolveBlindPeerKeys(extra = []) {
        const defaults = this._bootstrapNodes ? [] : BLIND_PEER_KEYS;
        const merged = new Map(defaults.map((key) => [b4a.toHex(key), key]));
        for (const key of this._blindPeerKeys ?? []) {
            merged.set(b4a.toHex(key), key);
        }
        for (const key of extra) {
            merged.set(b4a.toHex(key), key);
        }
        return [...merged.values()];
    }
    async _startMesh(opts = {}) {
        const mesh = await this._switchToMesh(opts);
        this._bringMeshOnline(mesh, opts);
        return mesh;
    }
    async _switchToMesh(opts = {}) {
        if (this.closing)
            throw new CoreError('CORE_CLOSING');
        if (this._blockedByMinVersion())
            throw new CoreError('MESH_BELOW_FLOOR');
        const previous = this._accountMesh();
        if (previous) {
            await this._retirePooledMesh(previous);
        }
        const mesh = await this._openMesh(opts);
        if (this.closing) {
            await this._retireMesh(mesh);
            throw new CoreError('CORE_CLOSING');
        }
        const halted = mesh.interrupted;
        if (halted) {
            this._withdrawFromMesh(mesh, halted);
            throw halted;
        }
        await this._adoptAccount(mesh);
        return mesh;
    }
    async _openMesh(opts = {}) {
        const session = await this.local.resolveSession(this._requireDeviceKeyPair().publicKey, opts);
        return this._openMeshSession(session, opts);
    }
    async _openMeshSession(session, { blindPeerKeys, account, sharing, workspace, project } = {}) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const mesh = this._newMesh(session, session.role ?? (account ? 'account' : 'project'), blindPeerKeys);
        try {
            await mesh.ready();
            if (session.baseKey && mesh.localLength === 0) {
                this._requireLocalDevice();
                await this.local.recordMesh(mesh.key, session, { deviceId, account });
                if (session.workspaceKey) {
                    this._joinProjectWhenListed(mesh, deviceId);
                }
                else {
                    void this._appendJoinLater(mesh, () => this._knownBirthMember(mesh, deviceId), sharing);
                }
            }
            else {
                await this._appendOwnBirth(mesh, session, {
                    deviceId,
                    account,
                    sharing,
                    workspace,
                    project
                });
            }
        }
        catch (err) {
            if (mesh.opened && mesh.interrupted && !this._upgradeRequired) {
                this._setUpgradeRequired('halt');
            }
            await mesh.close().catch(noop);
            throw err;
        }
        this._poolEntry(mesh);
        return mesh;
    }
    _newMesh(session, role, blindPeerKeys) {
        const mesh = new Mesh(this.store, {
            seed: session.seed,
            key: session.baseKey ?? null,
            role,
            deviceId: this._requireDeviceKeyPair().publicKey,
            writerSeed: session.writerSeed,
            logger: this._log,
            blindPeerKeys: this._resolveBlindPeerKeys(blindPeerKeys),
            trustedDevice: (deviceId) => this._isOurMemberDevice(deviceId),
            wakeup: this._wakeup,
            attachmentUrl: (attachment) => this._linkAttachment(attachment, mesh),
            fileIndex: this._fileIndexFor(() => mesh),
            pendingUpdates: this._pendingUpdatesFor(() => mesh),
            ...this._syncPacing
        });
        return mesh;
    }
    async _appendOwnBirth(mesh, session, { deviceId, account, sharing, workspace, project }) {
        await raceResource(mesh.autobee, (async () => {
            const birth = sharing
                ? await this._accountBirthMember(mesh, session)
                : await this._mintBirthMember(mesh, deviceId, session);
            await mesh.appendBirthOp(this._requireDeviceKeyPair(), this._localDevice ?? undefined, {
                member: birth?.member,
                sharing,
                workspace,
                project
            });
            await this.local.recordMesh(mesh.key, session, { deviceId, account });
            if (account && birth?.mnemonic) {
                await this._publishRecovery(birth.mnemonic, {
                    meshKey: mesh.key,
                    seed: session.seed,
                    createdAt: Date.now()
                });
            }
        })(), 'mesh');
    }
    _requireLocalDevice() {
        if (!this._localDevice)
            throw new Error(DEVICE_UNKNOWN);
        return this._localDevice;
    }
    _appendJoinLater(mesh, member, sharing = false) {
        const birth = async () => ({ member: (await member()) ?? undefined, sharing });
        const appended = mesh.appendBirthOp(this._requireDeviceKeyPair(), this._localDevice ?? undefined, birth);
        return appended.catch((err) => {
            if (this.closing || mesh.closing)
                return;
            if (mesh.interrupted && !this._upgradeRequired) {
                this._setUpgradeRequired('halt');
            }
            this._log?.warn(['p2p', 'mesh'], 'appending the join failed', err);
        });
    }
    _joinProjectWhenListed(mesh, deviceId) {
        let sent = false;
        const attempt = async () => {
            const known = await this._knownMember(mesh);
            if (sent || mesh.closing || !known || !(await inProject(mesh.view, known.id))) {
                return;
            }
            const own = await mesh.view.get(DEVICES, { id: deviceId });
            if (this._kickedProjects.has(this._meshIdOf(mesh)) && !own?.revoked) {
                return;
            }
            sent = true;
            this._kickedProjects.delete(this._meshIdOf(mesh));
            mesh.off('meshes-dirty', retry);
            await this._appendJoinLater(mesh, () => this._knownBirthMember(mesh, deviceId, known));
        };
        const retry = () => {
            attempt().catch((err) => {
                if (!mesh.closing) {
                    this._log?.warn(['p2p', 'mesh'], 'joining the project failed', err);
                }
            });
        };
        mesh.on('meshes-dirty', retry);
        retry();
    }
    async _accountBirthMember(mesh, session) {
        if (!this._localDevice || session.baseKey || mesh.localLength > 0) {
            return undefined;
        }
        const known = await this._knownMember(mesh);
        if (!known) {
            return undefined;
        }
        return {
            member: {
                member: {
                    id: known.id,
                    name: known.name,
                    joinedAt: Date.now(),
                    updatedAt: known.updatedAt
                },
                proof: known.proof
            },
            mnemonic: null
        };
    }
    async _mintBirthMember(mesh, deviceId, session) {
        const local = this._localDevice;
        if (!local || session.baseKey || mesh.localLength > 0) {
            return undefined;
        }
        const now = Date.now();
        const { identity, mnemonic } = await this.local.ensureIdentity(deviceId, now);
        this._identityPublicKey = identity.publicKey;
        this._holdIdentityPhrase(mnemonic);
        return {
            member: {
                member: {
                    id: identity.publicKey,
                    name: identity.displayName ?? local.name,
                    joinedAt: now,
                    updatedAt: namedAt(identity)
                },
                proof: identity.proof
            },
            mnemonic
        };
    }
    async publishAccountRecovery(mnemonic) {
        if (!this.opened)
            await this.ready();
        const account = await this.local.accountMesh(this._requireDeviceKeyPair().publicKey);
        const mesh = this._accountMesh();
        if (!account || !(mesh?.key && b4a.equals(mesh?.key, account.key))) {
            throw new CoreError('RECOVERY_NO_ACCOUNT');
        }
        const record = { meshKey: account.key, seed: account.seed, createdAt: Date.now() };
        return this._publishRecovery(mnemonic, record, mesh);
    }
    async accountRecoverable() {
        if (!this.opened)
            await this.ready();
        const account = await this.local.accountMesh(this._requireDeviceKeyPair().publicKey);
        if (!account) {
            return false;
        }
        const recovery = await this.local.readAccountRecovery(account.key);
        return recovery !== null;
    }
    async _publishRecovery(mnemonic, record, account) {
        const identity = await openIdentity(mnemonic);
        if (!this._identityPublicKey ||
            !b4a.equals(this._identityPublicKey, identity.identityPublicKey)) {
            throw new CoreError('RECOVERY_PHRASE_NOT_OURS');
        }
        if (account) {
            const member = await account.view
                .get(MEMBERS, { id: identity.identityPublicKey })
                .catch(noop);
            if (!member) {
                throw new CoreError('RECOVERY_PHRASE_NOT_A_MEMBER');
            }
        }
        const core = await this._openOwnRecoveryCore(recoveryKeys(identity));
        const appended = await publishRecovery(core, record);
        const held = await readRecovery(core);
        if (this._blindPeeringOn && held?.meshKey && b4a.equals(held.meshKey, record.meshKey)) {
            await this._markRecoverable(held, core);
        }
        this._peerRecoveryCore(core);
        return appended;
    }
    _markRecoverable(record, core) {
        return this.local.recordAccountRecovery({
            meshKey: record.meshKey,
            coreKey: core.key,
            publishedAt: record.createdAt
        });
    }
    async _openOwnRecoveryCore(keys) {
        const signer = keys.coreKeyPair.publicKey;
        if (this._recoveryCore && this._recoverySigner && b4a.equals(this._recoverySigner, signer)) {
            return this._recoveryCore;
        }
        const core = openRecoveryCore(this.store, keys);
        await core.ready();
        await this._adoptRecoveryCore(core, signer);
        return core;
    }
    async _adoptRecoveryCore(core, signer) {
        const previous = this._recoveryCore;
        this._recoveryCore = core;
        this._recoverySigner = signer;
        await previous?.close();
    }
    async recoverAccount(mnemonic, { timeout = RECOVERY_WAIT_MS } = {}) {
        await this._awaitMesh();
        this._requireLocalDevice();
        const identity = await openIdentity(mnemonic);
        const keys = recoveryKeys(identity);
        const core = openRecoveryCore(this.store, keys);
        let record;
        try {
            record = await this._readRecovery(core, timeout);
        }
        catch (err) {
            await core.close();
            throw err;
        }
        await this._meshTransitionLock.lock();
        let ownsTransition = false;
        try {
            if (this.closing) {
                throw new CoreError('CORE_CLOSING', ['Core']);
            }
            if (this._leaving || this._minting) {
                throw new CoreError('MESH_TRANSITION_IN_PROGRESS');
            }
            ownsTransition = true;
            this._minting = true;
            this._notifyStatus();
            const joined = await this._joinRecoveredAccount(identity, record);
            await this._rerootRecovered(identity, record, joined);
            await this._markRecoverable(record, core);
            await this._adoptRecoveryCore(core, keys.coreKeyPair.publicKey);
        }
        catch (err) {
            await core.close();
            throw err;
        }
        finally {
            if (ownsTransition) {
                this._minting = false;
            }
            this._meshTransitionLock.unlock();
            this._notifyStatus();
            this._departures?.flush();
        }
    }
    async _joinRecoveredAccount(identity, record) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const proof = await identity.bootstrap(deviceId);
        const meshId = b4a.toHex(record.meshKey);
        await this._opening.get(meshId)?.catch(noop);
        const pooled = this._pooled(meshId);
        if (pooled?.writable) {
            if (!this._isAccount(pooled)) {
                await this._adoptAccount(pooled);
            }
            return { proof, recovered: false };
        }
        const recovery = { memberId: identity.identityPublicKey, proof };
        await this._joinMesh({ seed: record.seed, baseKey: record.meshKey, fastForward: null, recovery }, pooled);
        return { proof, recovered: true };
    }
    async _rerootRecovered(identity, record, { proof, recovered }) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const mesh = this._accountMesh();
        if (!mesh?.key || !b4a.equals(mesh.key, record.meshKey)) {
            throw new CoreError('RECOVERY_NOT_ADOPTED');
        }
        if (this._identityPublicKey &&
            b4a.equals(this._identityPublicKey, identity.identityPublicKey)) {
            return;
        }
        const now = Date.now();
        await this.local.replaceIdentity({
            publicKey: identity.identityPublicKey,
            proof,
            createdAt: now
        });
        this._identityPublicKey = identity.identityPublicKey;
        if (recovered) {
            return;
        }
        await mesh.dispatch('attest-member-device', {
            deviceId,
            memberId: identity.identityPublicKey,
            proof,
            attestedAt: now
        });
    }
    async _readRecovery(core, timeout) {
        await core.ready();
        this._peerRecoveryCore(core);
        try {
            const record = await readRecovery(core, { timeout });
            if (record) {
                return record;
            }
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'no blind peer served a recovery record', err);
        }
        throw new CoreError('RECOVERY_RECORD_NOT_FOUND');
    }
    _peerRecoveryCore(core) {
        if (!this._swarm || this.closing || !this._blindPeeringOn)
            return;
        const keys = this._resolveBlindPeerKeys();
        if (keys.length === 0) {
            return;
        }
        const peering = this._blindPeeringClient();
        if (!peering) {
            return;
        }
        peering.addCoreBackground(core, { keys, pick: keys.length });
        this._log?.info(['p2p', 'mesh'], 'blind peering an account recovery core');
    }
    async _closeBlindPeering() {
        const peering = this._blindPeering;
        this._blindPeering = null;
        this._configPeered = false;
        await peering?.close();
    }
    async _closeRecovery() {
        const core = this._recoveryCore;
        this._recoveryCore = null;
        this._recoverySigner = null;
        await core?.close();
    }
    async _joinBirthMember(mesh, deviceId) {
        const local = this._localDevice;
        if (!local || mesh.localLength > 0) {
            return undefined;
        }
        const known = await this._knownBirthMember(mesh, deviceId);
        if (known) {
            return known;
        }
        const now = Date.now();
        const attestation = claimAttestation(mesh.publicKey, deviceId, mesh.localWriterKey);
        const { identity, mnemonic } = await this.local.ensureIdentity(deviceId, now);
        this._identityPublicKey = identity.publicKey;
        this._holdIdentityPhrase(mnemonic);
        const proof = await attestMemberClaim(attestation, this._requireDeviceKeyPair(), identity.proof);
        return {
            member: {
                id: identity.publicKey,
                name: identity.displayName ?? local.name,
                joinedAt: now,
                updatedAt: namedAt(identity)
            },
            proof
        };
    }
    async _knownBirthMember(mesh, deviceId, given) {
        if (!this._localDevice || mesh.localLength > 0)
            return null;
        const known = given ?? (await this._knownMember(mesh));
        if (!known) {
            return null;
        }
        const identity = await this.local.readIdentity();
        const name = identity?.displayName;
        const ours = identity && name && namedAt(identity) >= known.updatedAt;
        const attestation = claimAttestation(mesh.publicKey, deviceId, mesh.localWriterKey);
        return {
            member: {
                id: known.id,
                name: ours ? name : known.name,
                joinedAt: Date.now(),
                updatedAt: ours ? namedAt(identity) : known.updatedAt
            },
            proof: await attestMemberClaim(attestation, this._requireDeviceKeyPair(), known.proof)
        };
    }
    async _recoveryBirthMember(mesh, recovery) {
        const deviceKeyPair = this._requireDeviceKeyPair();
        const attestation = claimAttestation(mesh.publicKey, deviceKeyPair.publicKey, mesh.localWriterKey);
        await this.local.recordMemberProof({
            meshKey: mesh.key,
            memberId: recovery.memberId,
            proof: recovery.proof,
            attestedAt: 0
        });
        return {
            member: {
                id: recovery.memberId,
                name: this._localDevice?.name ?? '',
                joinedAt: Date.now(),
                updatedAt: 0
            },
            proof: await attestMemberClaim(attestation, deviceKeyPair, recovery.proof)
        };
    }
    _holdIdentityPhrase(mnemonic) {
        if (!mnemonic)
            return;
        this._identityPhrase = mnemonic;
        void this._pushIdentityPhrase();
    }
    async _pushIdentityPhrase() {
        const phrase = this._identityPhrase;
        if (!phrase || this._rpcs.size === 0 || this.closing) {
            return;
        }
        this._identityPhrase = null;
        for (const rpc of this._rpcs) {
            if (await this._offerIdentityPhrase(rpc, phrase))
                return;
        }
        this._identityPhrase = phrase;
        this._log?.warn(['api'], 'the host stored no recovery phrase');
    }
    async _offerIdentityPhrase(rpc, phrase) {
        try {
            return (await rpc.storeIdentityPhrase({ phrase })).ok;
        }
        catch {
            return false;
        }
    }
    _startBlindPeering(mesh) {
        const peering = this._blindPeeringClient();
        if (peering) {
            mesh.startBlindPeering(peering);
        }
    }
    async setBlindPeering(enabled) {
        if (enabled !== this._blindPeeringOn) {
            this._blindPeeringOn = enabled;
            await (enabled ? this._resumeBlindPeering() : this._stopBlindPeering());
            this._log?.info(['p2p', 'mesh'], enabled ? 'blind peering on' : 'blind peering off');
            for (const listener of this._blindPeeringListeners) {
                listener();
            }
        }
        await this.local.set(BLIND_PEERING_OFF_KEY, !this._blindPeeringOn);
        return { enabled: this._blindPeeringOn };
    }
    _peeredMeshes() {
        const meshes = [...this._meshes.values()].map((entry) => entry.mesh);
        return this._candidateMesh ? [...meshes, this._candidateMesh] : meshes;
    }
    async _stopBlindPeering() {
        const peering = this._blindPeering;
        this._blindPeering = null;
        this._configPeered = false;
        for (const mesh of this._peeredMeshes()) {
            mesh.stopBlindPeering();
        }
        this._departures?.stopBlindPeering();
        await peering?.close();
        this._notifyStatus();
    }
    async _resumeBlindPeering() {
        for (const mesh of this._peeredMeshes()) {
            this._startBlindPeering(mesh);
        }
        this._peerConfigCore();
        if (this._recoveryCore) {
            this._peerRecoveryCore(this._recoveryCore);
        }
        this._departures?.startBlindPeering();
        await this._fsDrives?.startBlindPeering();
    }
    _bringMeshOnline(mesh, opts = {}) {
        if (this.closing || !this._isPooled(mesh))
            return;
        const announce = opts.announce ?? true;
        if (this._swarm) {
            if (announce) {
                this._swarm.join(mesh.discoveryKey, { server: true, client: true });
            }
            this._startBlindPeering(mesh);
            if (this.suspended) {
                void mesh.suspend().catch(noop);
            }
            this._log?.info(['p2p', 'swarm'], 'brought the mesh online', {
                mesh: b4a.toHex(mesh.key).slice(0, 8),
                account: this._isAccount(mesh),
                announce,
                blindPeers: mesh.blindPeerKeys.length
            });
        }
        if (!opts.new) {
            void this._ensureNotRevoked(mesh);
        }
        this._departures?.flush();
        void this._advertiseAppVersion(mesh, this._requireDeviceKeyPair().publicKey);
        void this._advertiseDeviceProfile(mesh, this._requireDeviceKeyPair().publicKey);
        void this._retractInventory(mesh, this._requireDeviceKeyPair().publicKey);
        void this._settleMembership(mesh, { migrate: true });
    }
    async _advertiseDeviceProfile(mesh, deviceId) {
        const local = this._localDevice;
        if (!local?.platform) {
            return;
        }
        try {
            await mesh.waitForWritable();
            if (!this._isPooled(mesh)) {
                return;
            }
            const snap = mesh.view.snapshot();
            let existing;
            try {
                existing = await snap.get(DEVICES, { id: deviceId });
            }
            finally {
                await snap.close();
            }
            if (existing?.platform === local.platform &&
                existing.capabilityProfile === local.capabilityProfile &&
                existing.recommendedModelName === local.recommendedModelName) {
                return;
            }
            await mesh.dispatch('update-device-profile', {
                deviceId,
                capabilityProfile: local.capabilityProfile,
                recommendedModelName: local.recommendedModelName,
                platform: local.platform
            });
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'advertising the device profile failed', err);
        }
    }
    async _advertiseAppVersion(mesh, deviceId) {
        const app = this._app;
        if (!app) {
            return;
        }
        try {
            await mesh.waitForWritable();
            if (!this._isPooled(mesh) || !this._isAccount(mesh)) {
                return;
            }
            const snap = mesh.view.snapshot();
            let existing;
            try {
                existing = await snap.get(DEVICES, { id: deviceId });
            }
            finally {
                await snap.close();
            }
            if (existing?.appVersion === app.version &&
                (existing.appBuild || undefined) === app.build &&
                existing.appChannel === app.channel) {
                return;
            }
            await advertiseDeviceVersion(mesh, deviceId, app);
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'advertising app version failed', err);
        }
    }
    async _retractInventory(mesh, deviceId) {
        try {
            await mesh.waitForWritable();
            if (!this._isPooled(mesh)) {
                return;
            }
            await retractInventory(mesh, deviceId, (held) => this._isAccount(held));
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'retracting the device inventory failed', err);
        }
    }
    async _settleMembership(mesh, { migrate = false } = {}) {
        if (!this._localDevice)
            return;
        const entry = this._meshes.get(this._meshIdOf(mesh));
        if (entry?.mesh !== mesh) {
            return;
        }
        if (!(await entry.memberLock.lock())) {
            return;
        }
        try {
            await mesh.waitForWritable();
            if (!this._isPooled(mesh)) {
                return;
            }
            await mesh.autobee.update();
            if (!this._isPooled(mesh)) {
                return;
            }
            const context = { deviceKeyPair: this._requireDeviceKeyPair(), log: this._log };
            if (migrate) {
                await runMigrations(mesh, { ...context, ...this._migrationContext() }, {
                    catalog: (mesh.role === 'public' && !this._isForeign(mesh)) ||
                        (await this._isStoredAccount(mesh))
                });
            }
            await this._claimOwnMembership(mesh, context);
            await this._backfillMeshSeeds(mesh).catch((err) => {
                this._log?.warn(['p2p', 'mesh'], 'backfilling mesh seeds failed', err);
            });
            await this._renameFoundedMember(mesh, context);
            await this._revokeInMeshes();
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'settling membership failed', err);
        }
        finally {
            entry.memberLock.unlock();
        }
    }
    async _renameFoundedMember(mesh, context) {
        let identity = await this.local.readIdentity();
        if (!identity) {
            return;
        }
        const adopt = (name, at) => this._adoptName(name, at);
        if (!identity.displayName || identity.displayNameAt) {
            await renameFoundedMember(mesh, context, { identity, adopt });
            return;
        }
        if (!this._isAccount(mesh)) {
            return;
        }
        const stamp = await legacyNameStamp(mesh, context, identity);
        if (stamp) {
            const stamped = await this.local.saveDisplayName(identity.displayName, stamp);
            identity = stamped ?? identity;
        }
        await renameFoundedMember(mesh, context, { identity, adopt });
        const named = await this.local.readIdentity();
        if (named?.displayNameAt) {
            void this._followAccountName(mesh);
        }
    }
    async _adoptName(name, namedAt) {
        await this.local.saveDisplayName(name, namedAt);
        this._notifyStatus();
    }
    async _followAccountName(account) {
        const context = { deviceKeyPair: this._requireDeviceKeyPair(), log: this._log };
        const rename = (mesh) => this._renameFoundedMember(mesh, context).catch((err) => this._log?.warn(['p2p', 'mesh'], 'naming the member in this mesh failed', err));
        if (account.writable) {
            await rename(account);
        }
        for (const { mesh } of this._meshes.values()) {
            if (mesh.writable && mesh !== account) {
                void rename(mesh);
            }
        }
    }
    async _claimOwnMembership(mesh, context) {
        if (mesh.ourMemberId)
            return;
        const known = await this._knownMember(mesh);
        if (known) {
            await claimOwnMembership(mesh, context, known);
        }
    }
    async _knownMember(exclude) {
        for (const entry of this._meshes.values()) {
            if (entry.mesh === exclude || !entry.mesh.ourMemberId)
                continue;
            const known = await this._memberIn(entry.mesh).catch(noop);
            if (known) {
                return known;
            }
        }
        return this._recordedMember();
    }
    async _memberIn(mesh) {
        const own = await mesh.view.get(DEVICES, {
            id: this._requireDeviceKeyPair().publicKey
        });
        if (!own?.memberId || !own.memberProof) {
            return null;
        }
        const member = await mesh.view.get(MEMBERS, { id: own.memberId });
        if (!member) {
            return null;
        }
        return { id: member.id, name: member.name, updatedAt: member.updatedAt, proof: own.memberProof };
    }
    async _recordedMember() {
        const account = await this._storedAccountKey();
        const link = account ? await this.local.readMemberProof(account) : null;
        if (!link) {
            return null;
        }
        const name = (await this.local.readIdentity())?.displayName ?? '';
        return { id: link.memberId, name, updatedAt: 0, proof: link.proof };
    }
    _migrationContext() {
        const local = this._localDevice;
        if (!local) {
            throw new Error('local device read before the offline boot');
        }
        return {
            device: {
                id: this._requireDeviceKeyPair().publicKey,
                platform: this._device?.platform ?? local.platform
            },
            deviceName: local.name,
            mintRoot: async (deviceId, at) => {
                const { identity, mnemonic } = await this.local.ensureIdentity(deviceId, at);
                this._identityPublicKey = identity.publicKey;
                this._holdIdentityPhrase(mnemonic);
                return { publicKey: identity.publicKey, proof: identity.proof };
            }
        };
    }
    async _recordMemberProof(mesh, membership) {
        try {
            await this.local.recordMemberProof({ meshKey: mesh.key, ...membership });
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'keeping our membership proof failed', err);
        }
    }
    async _ensureNotRevoked(mesh) {
        const wasAccount = this._isAccount(mesh);
        try {
            const revocation = (await mesh.checkResumedRevocation()) ?? ((await mesh.ownWriterRefused()) ? 'kicked' : null);
            if (!revocation || !this._isPooled(mesh)) {
                return;
            }
            if (!wasAccount || !this._isAccount(mesh)) {
                if (revocation !== 'kicked') {
                    return;
                }
                this._log?.info(['p2p', 'mesh'], 'a sibling mesh kicked this device, closing it');
                await this._departKicked(mesh);
                return;
            }
            this._log?.info(['p2p', 'mesh'], `resumed already revoked (${revocation} while offline), replacing the account`);
            if (revocation === 'kicked') {
                this._kickedPending = true;
            }
            await this._replaceRevokedAccount(mesh);
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'resumed revocation check failed', err);
        }
    }
    async _retireMesh(mesh) {
        this._unpoolMesh(mesh);
        if (this._swarm) {
            await this._swarm.leave(mesh.discoveryKey).catch(noop);
        }
        await mesh.close();
        if (mesh.role === 'account' && this._meshIdOf(mesh) === this._accountId) {
            await this._retirePublicMeshes();
        }
    }
    _retirePooledMesh(mesh) {
        const key = this._meshIdOf(mesh);
        const retiring = this._retirePooled(mesh).finally(() => {
            if (this._retiring.get(key) === retiring) {
                this._retiring.delete(key);
            }
        });
        this._retiring.set(key, retiring);
        return retiring;
    }
    async _retirePooled(mesh) {
        const entry = this._meshes.get(this._meshIdOf(mesh));
        this._unpoolMesh(mesh);
        try {
            this._notifyStatus();
            await this.listMeshes().catch(noop);
            await this._stopMeshServices(entry?.mesh === mesh ? entry : null);
        }
        finally {
            await this._retireMesh(mesh);
        }
    }
    async _teardownMesh(target, { depart = false, purge = false } = {}) {
        const key = b4a.isBuffer(target) ? target : target.key;
        const mesh = b4a.isBuffer(target) ? this._pooled(b4a.toHex(key)) : target;
        if (mesh && depart) {
            await this._recordDeparture(mesh);
        }
        const cores = mesh && purge ? await mesh.ownCoreDiscoveryKeys(this.storage) : undefined;
        await this.local.dropMesh(key, { keepDeparture: true, cores });
        try {
            if (mesh) {
                await this._retirePooledMesh(mesh);
            }
        }
        finally {
            await this.local.dropMesh(key, { keepDeparture: true, cores });
            this._meshNames.delete(b4a.toHex(key));
            this._notifyStatus();
        }
        if (cores) {
            await this._finishPurge(key);
        }
    }
    async _stopMeshServices(entry) {
        if (!entry)
            return;
        await this._stopEntryIndexing(entry);
        this._releaseVectorIndex(entry);
    }
    async _stopEntryIndexing(entry) {
        const files = entry.processingFiles;
        if (!files) {
            return;
        }
        entry.processingFiles = null;
        if (!(await files.stopProcessing())) {
            entry.vectorIndex = null;
        }
    }
    _releaseVectorIndex(entry) {
        this._spareVectorIndex ??= entry.vectorIndex;
        entry.vectorIndex = null;
    }
    _withdrawFromMesh(mesh, err) {
        if (this.closing)
            return;
        if (!this._upgradeRequired) {
            this._log?.error(['p2p', 'mesh'], 'mesh needs a newer build - withdrawing from it', err);
            this._setUpgradeRequired('halt');
        }
        this._retirePooledMesh(mesh).catch((retireErr) => {
            this._log?.warn(['p2p', 'mesh'], 'retiring the stalled mesh failed', retireErr);
        });
    }
    _onKicked(mesh) {
        if (this.closing || this._leaving)
            return;
        if (!this._isAccount(mesh)) {
            this._log?.info(['p2p', 'mesh'], 'our writer was revoked on a sibling mesh, closing it');
            this._departKicked(mesh).catch((err) => this._log?.warn(['p2p', 'mesh'], 'closing the revoked sibling mesh failed', err));
            return;
        }
        this._log?.info(['p2p', 'mesh'], 'our writer was revoked (kicked), replacing the account');
        this._kicked = true;
        this._kickedPending = true;
        this._replaceRevokedAccount(mesh).catch((err) => this._log?.error(['p2p', 'mesh'], 'kick-driven replacement failed', err));
    }
    async _replaceRevokedAccount(mesh) {
        this._minting = true;
        this._notifyStatus();
        try {
            await this._departAllBut(mesh);
            if (this.closing) {
                return;
            }
            await this._archiveMembership(mesh);
        }
        finally {
            this._minting = false;
        }
        await this._requestFreshMesh();
    }
    async _departKicked(mesh) {
        const ours = mesh.ourMemberId;
        if (ours && mesh.role === 'workspace' && !(await liveMember(mesh.view, ours))) {
            await this._releaseJoinedMesh(mesh.key);
        }
        let purge = false;
        if (ours && mesh.role === 'project' && !(await inProject(mesh.view, ours))) {
            const record = await this.local.meshRecord(mesh.key);
            const workspace = record?.workspaceKey ? this._pooled(b4a.toHex(record.workspaceKey)) : null;
            const row = await workspace?.view.get(PROJECTS, { id: mesh.key });
            this._kickedProjects.set(this._meshIdOf(mesh), row && listsMember(row, ours) ? workspace : null);
            purge = record?.role === 'project' && !!record.workspaceKey;
        }
        await this._departRevokedMesh(mesh, { purge });
    }
    async _departRevokedMesh(mesh, opts = {}) {
        const account = this._accountMesh();
        if (this._isOwnPublic(mesh) && mesh.workspaceKey && account) {
            const record = await this._publicRecord(account, mesh.workspaceKey);
            await this._savePublicRecord(account, mesh.workspaceKey, freshPublicRecord(record?.migrated));
        }
        await this._teardownMesh(mesh, opts);
    }
    async _archiveMembership(mesh) {
        if (!mesh)
            return;
        try {
            await this.local.archiveMesh(mesh.key);
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'archiving the departed mesh row failed', error);
        }
    }
    async _requestFreshMesh() {
        if (this.closing || this._minting)
            return;
        this._minting = true;
        this._notifyStatus();
        try {
            this.emit('mesh-changed', await this._startMesh({ new: true, account: true }));
        }
        catch (err) {
            if (this.closing) {
                return;
            }
            if (!this._upgradeRequired) {
                this._statusError = statusErrorMessage('creating a new mesh failed', err);
            }
            if (!this.emit('mesh-error', err)) {
                throw err;
            }
        }
        finally {
            this._minting = false;
            this._notifyStatus();
        }
    }
    _onClose(listener) {
        if (this._closeSignaled) {
            listener();
            return noop;
        }
        this._closeListeners.add(listener);
        return () => void this._closeListeners.delete(listener);
    }
    _waitForMeshChange() {
        return new Promise((resolve) => {
            let offClose = noop;
            const settle = (error) => {
                this.off('mesh-changed', onChanged);
                this.off('mesh-error', onError);
                offClose();
                resolve(error);
            };
            const onChanged = () => settle(null);
            const onError = (error) => settle(error);
            this.on('mesh-changed', onChanged);
            this.on('mesh-error', onError);
            offClose = this._onClose(onChanged);
        });
    }
    async joinMesh(rawInvite) {
        const invite = decodeMeshInvite(rawInvite);
        if (!invite) {
            throw new CoreError('INVITE_INVALID');
        }
        if (invite.compute) {
            throw new CoreError('COMPUTE_MESH_RETIRED');
        }
        await this._awaitMesh();
        this._requireLocalDevice();
        await this._meshTransitionLock.lock();
        let ownsTransition = false;
        try {
            if (this.closing) {
                throw new CoreError('CORE_CLOSING', ['Core']);
            }
            if (this._leaving || this._minting) {
                throw new CoreError('MESH_TRANSITION_IN_PROGRESS');
            }
            await this._opening.get(b4a.toHex(invite.baseKey))?.catch(noop);
            const pooled = this._pooled(b4a.toHex(invite.baseKey));
            if (pooled?.writable) {
                if (!invite.memberInvite && !this._isAccount(pooled)) {
                    await this._adoptAccount(pooled);
                }
                return;
            }
            ownsTransition = true;
            this._minting = true;
            this._notifyStatus();
            await this._joinMesh(invite, pooled);
        }
        finally {
            if (ownsTransition) {
                this._minting = false;
            }
            this._meshTransitionLock.unlock();
            this._notifyStatus();
            this._departures?.flush();
        }
    }
    cancelMeshJoin() {
        if (this._joinCancellation?.accepting) {
            this._joinCancellation.canceled = true;
        }
        this._cancelCandidateJoin?.();
    }
    _throwIfJoinCanceled() {
        if (this._joinCancellation?.canceled) {
            throw new CoreError('MESH_JOIN_CANCELED');
        }
    }
    async _joinMesh(invite, retire = null) {
        const cancellation = { canceled: false, accepting: true, account: !invite.memberInvite };
        this._joinCancellation = cancellation;
        try {
            if (invite.memberInvite) {
                await this._joinMeshInvite(invite);
            }
            else if (await this._reopenOwnAccount(invite)) {
                return;
            }
            else {
                if (!invite.recovery && !(invite.deviceSeed && invite.deviceProof && invite.memberId)) {
                    throw new CoreError('DEVICE_INVITE_UNDELEGATED');
                }
                await this._claimJoin(invite, retire ?? this._pooled(b4a.toHex(invite.baseKey)));
            }
        }
        finally {
            if (this._joinCancellation === cancellation) {
                this._joinCancellation = null;
            }
        }
    }
    async _reopenOwnAccount(invite) {
        if (invite.recovery || !invite.memberId)
            return false;
        const stored = await this._storedAccountKey();
        if (!stored || !b4a.equals(stored, invite.baseKey)) {
            return false;
        }
        if (!(await this.local.readMeshSession(invite.baseKey))) {
            return false;
        }
        const account = await this._openPooledMesh(b4a.toHex(invite.baseKey));
        if (!(await this._keepsWriter(account))) {
            return false;
        }
        if (!this._isAccount(account)) {
            await this._adoptAccount(account);
        }
        return true;
    }
    async _claimJoin(invite, retire) {
        const meshId = b4a.toHex(invite.baseKey);
        const claim = Promise.withResolvers();
        claim.promise.catch(noop);
        this._opening.set(meshId, claim.promise);
        try {
            if (retire) {
                await this._retirePooledMesh(retire);
            }
            await this._runJoinMesh(invite, claim);
        }
        catch (error) {
            claim.reject(error);
            throw error;
        }
        finally {
            if (this._opening.get(meshId) === claim.promise) {
                this._opening.delete(meshId);
            }
        }
    }
    async _joinMeshInvite(invite) {
        const meshId = b4a.toHex(invite.baseKey);
        await this._following.get(meshId);
        const joining = (async () => {
            if (!(await this._reopenRecordedMesh(invite))) {
                await this._claimJoin(invite, this._pooled(meshId));
            }
        })();
        const slot = joining.catch(noop);
        this._following.set(meshId, slot);
        try {
            await joining;
        }
        finally {
            if (this._following.get(meshId) === slot) {
                this._following.delete(meshId);
            }
        }
    }
    async _reopenRecordedMesh(invite) {
        if (!(await this.local.readMeshSession(invite.baseKey)))
            return false;
        return this._keepsWriter(await this._openPooledMesh(b4a.toHex(invite.baseKey)));
    }
    async _keepsWriter(mesh) {
        if (mesh.writable)
            return true;
        if (await mesh.ownWriterRefused()) {
            return false;
        }
        const own = await mesh.view.get(DEVICES, {
            id: this._requireDeviceKeyPair().publicKey
        });
        return !(own && isOwnRevokedRow(mesh, own));
    }
    async _runJoinMesh(invite, claim) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const source = this._accountMesh();
        for (const node of invite.additionalNodes ?? []) {
            this._swarm?.dht.addNode(node);
        }
        await this._departures?.park(invite.baseKey);
        try {
            await this._joinParkedMesh(invite, claim, { source, deviceId });
        }
        finally {
            this._departures?.unpark(invite.baseKey);
        }
    }
    async _joinParkedMesh(invite, claim, { source, deviceId }) {
        const mesh = await this._joinCandidate(invite, source, deviceId);
        if (mesh) {
            claim.resolve(mesh);
        }
        else {
            claim.reject(new CoreError('MESH_BELOW_FLOOR'));
        }
    }
    _candidateSession({ seed, baseKey, workspace }) {
        const role = workspace ? 'workspace' : undefined;
        return this.local.createCandidateSession(seed, baseKey, { role });
    }
    async _joinCandidate(invite, source, deviceId) {
        const session = this._candidateSession(invite);
        let candidate;
        try {
            candidate = await this._openCandidateMesh(invite, session);
        }
        catch (error) {
            await this._discardCandidateMesh();
            throw error;
        }
        this._throwIfJoinCanceled();
        if (this._joinCancellation) {
            this._joinCancellation.accepting = false;
        }
        try {
            await this.local.recordMesh(candidate.key, session, { deviceId });
        }
        catch (error) {
            await this._discardCandidateMesh();
            throw error;
        }
        const member = await this._candidateBirthMember(candidate, invite);
        const appended = this._appendJoinLater(candidate, async () => member);
        return this._landJoinedMesh(candidate, {
            source,
            deviceId,
            memberInvite: !!invite.memberInvite,
            recovery: !!invite.recovery,
            appended
        });
    }
    async _landJoinedMesh(candidate, { source, deviceId, memberInvite, recovery, appended }) {
        if (!memberInvite) {
            await this._departOldAccount(candidate.key, source, { keepName: recovery });
        }
        if (this._blockedByMinVersion()) {
            if (!memberInvite) {
                await this.local.setAccountMesh(deviceId, candidate.key);
            }
            void appended
                .then(() => this._retireMesh(candidate))
                .catch((err) => this._log?.warn(['p2p', 'mesh'], 'withholding the joined mesh failed', err));
            return null;
        }
        if (memberInvite) {
            this._candidateMesh = null;
            if (!candidate.writable) {
                await this.local.markAwaitingAdmission(candidate.key, { awaitingAdmission: true });
            }
            this._wireMesh(this._poolEntry(candidate));
            this._bringMeshOnline(candidate);
            if (candidate.writable) {
                await this.local.markAwaitingAdmission(candidate.key, { awaitingAdmission: false });
            }
            this._notifyStatus();
        }
        else {
            await this._adoptAccount(candidate);
        }
        void this._departures?.drop(candidate.key).catch(noop);
        void this._advertiseDeviceProfile(candidate, deviceId);
        void candidate.refreshOurMember().catch(noop);
        void this._settleMembership(candidate, { migrate: true });
        if (memberInvite) {
            void this._recordJoinedMesh(candidate, appended);
        }
        this.emit('mesh-changed', candidate);
        return candidate;
    }
    async _departOldAccount(joined, source, { keepName }) {
        const account = (await this._storedAccountKey()) ?? source?.key;
        if (account && b4a.equals(account, joined)) {
            return;
        }
        const rows = (await this.local.listMeshes()).filter((row) => !b4a.equals(row.key, joined));
        const meshes = rows.filter((row) => !(account && b4a.equals(account, row.key)));
        await this.local.adoptAccountMesh(this._requireDeviceKeyPair().publicKey, joined, {
            account,
            keepName
        });
        for (const mesh of meshes) {
            await this._departIfPooled(mesh.key, 'mesh');
            await this.local.dropMesh(mesh.key, { keepDeparture: true });
            this._meshNames.delete(b4a.toHex(mesh.key));
        }
        if (account) {
            await this._departIfPooled(account, 'account');
        }
    }
    async _departIfPooled(key, kind) {
        const meshId = b4a.toHex(key);
        const mesh = this._pooled(meshId);
        if (!mesh) {
            this._log?.warn(['p2p', 'mesh'], `the old ${kind} was closed, so its writer was not revoked`, {
                meshId
            });
            return;
        }
        try {
            await this._recordDeparture(mesh);
            await this._retirePooledMesh(mesh);
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], `departing the old ${kind} failed`, error);
        }
    }
    async _recordJoinedMesh(mesh, appended) {
        try {
            await appended;
            const kind = await meshKind(mesh.view);
            const workspace = kind === 'workspace';
            if (kind && workspace !== (mesh.role === 'workspace')) {
                await this._reopenInRole(mesh, workspace ? 'workspace' : 'project');
            }
            await this._registerMesh(mesh.key, { shared: false, workspace });
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'recording the joined mesh failed', error);
        }
    }
    async _followUpgrade(mesh) {
        const meshId = this._meshIdOf(mesh);
        if (this.closing || this._upgrading.has(meshId)) {
            return;
        }
        this._upgrading.add(meshId);
        try {
            let kind = await meshKind(mesh.view);
            if (kind === 'shared' && (await this._upgradable(mesh))) {
                await mesh.dispatch('upgrade-to-workspace', { upgradedAt: Date.now() });
                kind = await meshKind(mesh.view);
            }
            if (kind === 'workspace' && mesh.writable && this._isPooled(mesh)) {
                await this.local.set(upgradeCheckedKey(mesh.key), GROUPS_PENDING);
                await this._markFoldDue(mesh.key);
                await this._reopenInRole(mesh, 'workspace');
                await this._markJoinedWorkspace(mesh.key);
            }
            else if (kind !== 'project' && (kind !== 'shared' || (await bornUnderRules(mesh.view)))) {
                await this._markUpgradeChecked(mesh.key);
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'upgrading a shared mesh to a workspace failed', err);
            }
        }
        finally {
            this._upgrading.delete(meshId);
        }
    }
    _followGroups(workspace) {
        if (this.closing || !workspace.writable) {
            return;
        }
        if (this._groupPasses.has(workspace)) {
            this._groupPassesDue.add(workspace);
            return;
        }
        this._groupPasses.add(workspace);
        void this._passGroups(workspace)
            .catch((err) => {
            if (!this.closing && this._isPooled(workspace)) {
                this._log?.warn(['p2p', 'mesh'], 'moving chat-groups into projects failed', err);
            }
        })
            .finally(() => {
            this._groupPasses.delete(workspace);
            if (this._groupPassesDue.delete(workspace)) {
                this._followGroups(workspace);
            }
        });
    }
    async _passGroups(workspace) {
        const checked = await this.local.get(upgradeCheckedKey(workspace.key));
        if (checked === true) {
            return this._passAgents(workspace);
        }
        if (checked !== GROUPS_PENDING) {
            return;
        }
        const ours = workspace.ourMemberId ?? (await workspace.refreshOurMember())?.memberId;
        if (!ours || !(await isWorkspace(workspace.view))) {
            return;
        }
        const buckets = await this._groupBuckets(workspace);
        const rows = await projectsByGroup(workspace.view);
        const settled = await Promise.all(buckets.map((bucket) => this._passGroup(workspace, ours, { bucket, row: rows.get(bucket.groupId) ?? null })));
        if (settled.every((state) => state === 'done') && this._isPooled(workspace)) {
            await this.local.set(upgradeCheckedKey(workspace.key), true);
        }
        if (!settled.includes('pending')) {
            await this._passAgents(workspace);
        }
    }
    async _groupBuckets(workspace) {
        const named = workspace.name?.name?.trim() || 'Workspace';
        const groups = await liveGroups(workspace.view);
        const ids = [...groups.map((group) => group.id), UNGROUPED];
        const records = await Promise.all(ids.map((id) => this._groupRecord(workspace, id)));
        if (!records.every((record) => record.copied || record.done)) {
            return this._scanBuckets(workspace, named);
        }
        return ids.map((groupId, idx) => ({
            groupId,
            name: groups[idx]?.name ?? named,
            chats: new Set()
        }));
    }
    async _markFoldDue(workspaceKey) {
        const key = agentsFoldKey(workspaceKey);
        if ((await this.local.get(key)) !== true) {
            await this.local.set(key, FOLD_PENDING);
        }
    }
    async _passAgents(workspace) {
        if ((await this.local.get(agentsFoldKey(workspace.key))) !== FOLD_PENDING) {
            return;
        }
        const copies = await ownCopies(workspace, this._requireDeviceKeyPair().publicKey);
        if (copies.length > 0) {
            const account = await this._writableAccount();
            const projects = await this._heldProjects(workspace);
            if (!account || !projects) {
                return;
            }
            await foldAgents({ account, workspace, projects, picks: this._agentPicks() }, copies);
        }
        if (this._isPooled(workspace)) {
            await this.local.set(agentsFoldKey(workspace.key), true);
        }
    }
    async _heldProjects(workspace) {
        const ours = workspace.ourMemberId;
        const held = [];
        for (const row of await workspace.view.find(PROJECTS).toArray()) {
            if (row.deletedAt || !ours || !listedProject(row, ours))
                continue;
            const project = await this._heldMesh(row.id);
            if (!project?.writable) {
                return null;
            }
            held.push(project);
        }
        return held;
    }
    async _groupRecord(workspace, groupId) {
        const stored = await this.local.get(groupRecordKey(workspace.key, groupId));
        return isGroupRecord(stored) ? stored : {};
    }
    async _scanBuckets(workspace, named) {
        const buckets = await groupBuckets(workspace.view, named);
        const ungrouped = buckets.some((bucket) => bucket.groupId === UNGROUPED);
        if (!ungrouped && !(await this._groupRecord(workspace, UNGROUPED)).key) {
            await this.local.set(groupRecordKey(workspace.key, UNGROUPED), { done: true });
        }
        return buckets;
    }
    async _passGroup(workspace, ours, { bucket, row: listed }) {
        const recordKey = groupRecordKey(workspace.key, bucket.groupId);
        let record = await this._groupRecord(workspace, bucket.groupId);
        if (record.done) {
            return 'done';
        }
        let row = listed;
        if (!row) {
            record = await this._foundGroupProject(workspace, bucket, { recordKey, record });
            row = await projectOfGroup(workspace.view, bucket.groupId);
        }
        const live = !!row && !row.deletedAt;
        if (row && live && record.key === b4a.toHex(row.id)) {
            await this._listNewMembers(workspace, { row, recordKey, record });
            return 'won';
        }
        if (row && live && !(await this._mergeGroupInto(workspace, ours, { row, bucket, record }))) {
            return 'pending';
        }
        if (record.key) {
            await this._purgeProject(b4a.from(record.key, 'hex'));
        }
        await this.local.set(recordKey, { ...record, done: true });
        return 'done';
    }
    async _foundGroupProject(workspace, bucket, { recordKey, record }) {
        const held = record.key ? await this._heldMesh(b4a.from(record.key, 'hex')) : null;
        const name = projectName(bucket.name.trim() || 'Project');
        const project = held ?? (await this._openNewProject(workspace, { name, upgraded: true }));
        let next = { ...record, key: this._meshIdOf(project) };
        await this.local.set(recordKey, next);
        await this._addWorkspaceMembers(workspace, project);
        if (!next.copied) {
            await this._copyGroup(workspace, project, bucket);
            next = { ...next, copied: true };
            await this.local.set(recordKey, next);
        }
        const now = Date.now();
        await this._listProject(workspace, project, {
            createdAt: now,
            updatedAt: now,
            groupId: bucket.groupId
        });
        this._notifyStatus();
        return next;
    }
    async _mergeGroupInto(workspace, ours, { row, bucket, record }) {
        const winner = listsMember(row, ours) ? await this._winnerOf(workspace, row) : null;
        if (!winner) {
            return false;
        }
        await this._addWorkspaceMembers(workspace, winner);
        await this._listWorkspaceMembers(workspace, row);
        const own = record.key ? await this._heldMesh(b4a.from(record.key, 'hex')) : null;
        if (own) {
            await copyContent({
                from: own,
                into: winner,
                deviceId: this._requireDeviceKeyPair().publicKey
            });
        }
        await this._copyGroup(workspace, winner, bucket);
        this._log?.info(['p2p', 'mesh'], 'merged a chat-group into the project that won it', {
            project: b4a.toHex(row.id).slice(0, 8)
        });
        return true;
    }
    async _winnerOf(workspace, row) {
        const projectId = b4a.toHex(row.id);
        if (!this._pooled(projectId) && !(await this.local.readMeshSession(row.id))) {
            await this._followProjects(workspace);
            await this._following.get(projectId);
        }
        const winner = this._pooled(projectId) ?? (await this._heldMesh(row.id));
        await winner?.waitForWritable();
        return winner;
    }
    async _copyGroup(workspace, project, { chats }) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        await copyContent({ from: workspace, into: project, deviceId, chats });
    }
    async _addWorkspaceMembers(workspace, project) {
        for (const memberId of await this._workspaceMembers(workspace)) {
            if (!(await inProject(project.view, memberId))) {
                await project.dispatch('put-project-member', { memberId });
            }
        }
    }
    async _listNewMembers(workspace, { row, recordKey, record }) {
        const listed = new Set(record.listedMembers ?? []);
        const members = await this._workspaceMembers(workspace);
        const added = members.filter((id) => !listed.has(b4a.toHex(id)));
        const project = added.length > 0 ? await this._heldMesh(row.id) : null;
        for (const memberId of added) {
            if (project && !(await inProject(project.view, memberId))) {
                await project.dispatch('put-project-member', { memberId });
            }
            if (!listsMember(row, memberId)) {
                await workspace.dispatch('set-project-listing', { projectId: row.id, memberId });
            }
        }
        if (added.length > 0) {
            const listedMembers = [...listed, ...added.map((id) => b4a.toHex(id))];
            await this.local.set(recordKey, { ...record, listedMembers });
        }
    }
    async _listWorkspaceMembers(workspace, row) {
        for (const memberId of await this._workspaceMembers(workspace)) {
            if (!listsMember(row, memberId)) {
                await workspace.dispatch('set-project-listing', { projectId: row.id, memberId });
            }
        }
    }
    async _workspaceMembers(workspace) {
        const live = await liveMemberIds(workspace.view);
        return (await upgradeMembers(workspace.view)).filter((id) => live.has(b4a.toHex(id)));
    }
    async _openUpgradable() {
        const account = await this._storedAccountKey();
        for (const row of await this.local.listMeshes()) {
            const skip = row.workspaceKey || (account && b4a.equals(row.key, account));
            const role = recordedRole(row);
            if (this.closing || skip || (role !== 'project' && role !== 'workspace')) {
                continue;
            }
            const checked = await this.local.get(upgradeCheckedKey(row.key));
            const due = role === 'workspace'
                ? checked === GROUPS_PENDING ||
                    (await this.local.get(agentsFoldKey(row.key))) === FOLD_PENDING
                : checked !== true;
            if (!due) {
                continue;
            }
            await this._openPooledMesh(b4a.toHex(row.key)).catch((err) => {
                this._log?.warn(['p2p', 'mesh'], 'opening a shared mesh to upgrade it failed', err);
            });
        }
    }
    async _markUpgradeChecked(meshKey) {
        const key = upgradeCheckedKey(meshKey);
        if ((await this.local.get(key)) !== true) {
            await this.local.set(key, true);
        }
    }
    async _upgradable(mesh) {
        if (!mesh.writable || (await rulesVersion(mesh.view)) < WORKSPACES_RULES) {
            return false;
        }
        return !(await bornUnderRules(mesh.view));
    }
    async _markJoinedWorkspace(meshKey) {
        const registry = await this._writableAccount();
        const joined = await registry?.view.get(JOINED_MESHES, { meshKey });
        if (!registry || !joined || joined.workspace || joined.leftAt) {
            return;
        }
        await registry.dispatch('put-joined-mesh', {
            room: {
                meshKey,
                memberId: joined.memberId,
                joinedAt: joined.joinedAt,
                label: joined.label,
                labeledAt: joined.labeledAt,
                shared: joined.shared,
                sharedAt: joined.sharedAt,
                workspace: true
            }
        });
    }
    async _reopenInRole(mesh, role) {
        await this.local.setMeshRole(mesh.key, role);
        await this._retirePooledMesh(mesh);
        const reopened = await this._openPooledMesh(this._meshIdOf(mesh));
        void reopened.wakeHeldWriters().catch(noop);
    }
    async _registerMesh(meshKey, opts) {
        const { shared, workspace = false } = opts;
        const registry = opts.registry ?? (await this._writableAccount());
        const ours = registry?.ourMemberId;
        if (!registry || !ours) {
            return;
        }
        const now = Date.now();
        await registry.dispatch('put-joined-mesh', {
            room: {
                meshKey,
                memberId: ours,
                joinedAt: now,
                shared,
                sharedAt: shared ? now : 0,
                workspace
            }
        });
        await this._backfillMeshSeeds(registry).catch((err) => {
            this._log?.warn(['p2p', 'mesh'], 'writing the mesh seed failed; writable or settle retries', err);
        });
    }
    async _backfillMeshSeeds(account, { register = true } = {}) {
        if (!this._isAccount(account))
            return;
        const pass = this._backfill.then(() => this._writeMeshSeeds(account, register));
        this._backfill = pass.catch(noop);
        await pass;
    }
    async _writeMeshSeeds(account, register) {
        const ours = account.ourMemberId;
        if (!ours || !this._isAccount(account) || !account.writable) {
            return;
        }
        const batch = account.batch();
        const registered = register
            ? await this._registerRecordedMeshes(account, ours, batch)
            : new Set();
        for (const { mesh } of this._meshes.values()) {
            if (await this._seedRowDue(account, mesh, { ours, registered })) {
                batch.dispatch('put-mesh-seed', { meshKey: mesh.key, seed: mesh.seed });
            }
        }
        await batch.flush();
    }
    async _registerRecordedMeshes(account, ours, batch) {
        const registered = new Set();
        const now = Date.now();
        for (const row of await this.local.listMeshes()) {
            if (b4a.equals(row.key, account.key) || row.workspaceKey) {
                continue;
            }
            const held = await account.view.get(JOINED_MESHES, { meshKey: row.key });
            if (held) {
                continue;
            }
            const pooled = this._pooled(b4a.toHex(row.key));
            batch.dispatch('put-joined-mesh', {
                room: {
                    meshKey: row.key,
                    memberId: ours,
                    joinedAt: now,
                    shared: false,
                    sharedAt: 0,
                    workspace: !!pooled && (await isWorkspace(pooled.view))
                }
            });
            registered.add(b4a.toHex(row.key));
        }
        return registered;
    }
    async _seedRowDue(account, mesh, { ours, registered }) {
        if (!mesh.writable || mesh === account)
            return false;
        if (registered.has(this._meshIdOf(mesh))) {
            return true;
        }
        const joined = await account.view.get(JOINED_MESHES, { meshKey: mesh.key });
        if (!joined?.memberId || !b4a.equals(joined.memberId, ours) || joined.leftAt) {
            return false;
        }
        const held = await account.view.get(MESH_SEEDS, { meshKey: mesh.key });
        return !held || !b4a.equals(held.seed, mesh.seed);
    }
    async _releaseJoinedMesh(meshKey, registry) {
        try {
            const held = registry ? [registry] : [...this._meshes.values()].map((entry) => entry.mesh);
            for (const mesh of held) {
                const ours = mesh.ourMemberId;
                if (!mesh.writable || !ours || b4a.equals(mesh.key, meshKey)) {
                    continue;
                }
                const joined = await mesh.view.get(JOINED_MESHES, { meshKey });
                if (!(joined?.memberId && b4a.equals(joined?.memberId, ours))) {
                    continue;
                }
                await mesh.dispatch('put-joined-mesh', {
                    room: { meshKey, memberId: ours, joinedAt: joined.joinedAt, leftAt: Date.now() }
                });
                return;
            }
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'releasing the joined mesh failed', error);
        }
    }
    async _writableAccount() {
        if (this.closing)
            return null;
        const key = await this._storedAccountKey();
        const held = key ? (this._pooled(b4a.toHex(key)) ?? this._opening.get(b4a.toHex(key))) : null;
        const mesh = key ? await this._openPooledMesh(b4a.toHex(key)).catch(noop) : null;
        if (mesh && !mesh.ourMemberId) {
            if (mesh.writable) {
                await mesh.autobee.update();
            }
            await mesh.refreshOurMember();
        }
        if (!mesh?.writable) {
            if (mesh && !held) {
                await this._retirePooledMesh(mesh).catch(noop);
            }
            this._log?.warn(['p2p', 'mesh'], 'no writable account mesh');
            return null;
        }
        return mesh;
    }
    async _openCandidateMesh(invite, session) {
        this._throwIfJoinCanceled();
        const candidate = new Mesh(this.store, {
            seed: session.seed,
            key: session.baseKey ?? null,
            role: session.role ?? (invite.memberInvite ? 'project' : 'account'),
            deviceId: this._requireDeviceKeyPair().publicKey,
            writerSeed: session.writerSeed,
            logger: this._log,
            blindPeerKeys: this._resolveBlindPeerKeys(invite.blindPeers),
            bootFrom: invite.fastForward,
            trustedDevice: (deviceId) => this._isOurMemberDevice(deviceId),
            wakeup: this._wakeup,
            attachmentUrl: (attachment) => this._linkAttachment(attachment, candidate),
            fileIndex: this._fileIndexFor(() => candidate),
            pendingUpdates: this._pendingUpdatesFor(() => candidate),
            ...this._syncPacing
        });
        this._candidateMesh = candidate;
        if (this._swarm) {
            this._swarm.join(candidate.discoveryKey, { server: true, client: true });
        }
        const onOpenCanceled = () => candidate.interruptBoot();
        this._cancelCandidateJoin = onOpenCanceled;
        const disarm = () => {
            if (this._cancelCandidateJoin === onOpenCanceled) {
                this._cancelCandidateJoin = null;
            }
        };
        try {
            await candidate.ready();
        }
        catch (error) {
            disarm();
            this._candidateMesh = null;
            if (this._swarm) {
                await this._swarm.leave(candidate.discoveryKey).catch(noop);
            }
            await candidate.close().catch(noop);
            throw this._joinCancellation?.canceled ? new CoreError('MESH_JOIN_CANCELED') : error;
        }
        this._startBlindPeering(candidate);
        try {
            this._throwIfJoinCanceled();
            if (!b4a.equals(candidate.key, invite.baseKey)) {
                throw new CoreError('JOIN_NOT_PERMITTED');
            }
            if ((await candidate.checkResumedRevocation()) === 'kicked') {
                throw new CoreError('JOIN_NOT_PERMITTED');
            }
            this._throwIfJoinCanceled();
            return candidate;
        }
        catch (error) {
            await this._discardCandidateMesh();
            throw this._joinCancellation?.canceled ? new CoreError('MESH_JOIN_CANCELED') : error;
        }
        finally {
            disarm();
        }
    }
    async _candidateBirthMember(candidate, invite) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        if (invite.recovery) {
            return this._recoveryBirthMember(candidate, invite.recovery);
        }
        const { deviceSeed, deviceProof, memberId } = invite;
        if (deviceSeed && deviceProof && memberId) {
            return this._delegatedBirthMember(candidate, {
                deviceSeed,
                deviceProof,
                memberId,
                name: invite.inviterName ?? ''
            });
        }
        return invite.memberInvite ? this._joinBirthMember(candidate, deviceId) : undefined;
    }
    async _delegatedBirthMember(mesh, { deviceSeed, deviceProof, memberId, name }) {
        const keyPair = this._requireDeviceKeyPair();
        const proof = await attestDeviceProof(keyPair.publicKey, crypto.keyPair(deviceSeed), deviceProof);
        const attestation = claimAttestation(mesh.publicKey, keyPair.publicKey, mesh.localWriterKey);
        await this.local.recordMemberProof({ meshKey: mesh.key, memberId, proof, attestedAt: 0 });
        return {
            member: { id: memberId, name, joinedAt: Date.now(), updatedAt: 0 },
            proof: await attestMemberClaim(attestation, keyPair, proof)
        };
    }
    _onMeshSeedDue(mesh) {
        const account = this._accountMesh();
        if (account) {
            void this._backfillMeshSeeds(account, { register: mesh === account }).catch(noop);
        }
    }
    _onProjectWritable(mesh) {
        if (mesh.role !== 'project')
            return;
        this._cascadeIntoProject(mesh).catch((err) => this._log?.warn(['p2p', 'mesh'], 'taking removed members out of an opened project failed', err));
    }
    _onSharedWritable(mesh) {
        if (mesh.role === 'project') {
            void this._followUpgrade(mesh);
            void this._followSharedAgents();
            void this._workspaceOf(mesh)
                .then((workspace) => workspace && this._followGroups(workspace))
                .catch(noop);
        }
        else if (mesh.role === 'workspace') {
            this._followGroups(mesh);
            void this._followSharedAgents();
            this._shareMemberKey(mesh);
            void this._followHosting();
        }
    }
    _onMeshWritable(mesh) {
        if (!this._isPooled(mesh))
            return;
        void this.local.markAwaitingAdmission(mesh.key, { awaitingAdmission: false }).catch(noop);
        this._onMeshSeedDue(mesh);
        this._onProjectWritable(mesh);
        this._onSharedWritable(mesh);
        if (this._isAccount(mesh)) {
            this._kicked = false;
            void this._followPublicMesh(mesh);
            void this._followSkillSecrets();
        }
        const account = this._accountMesh();
        if (account && this._meshIdOf(mesh) === this._ownWorkspaceId) {
            void this._followPublicMesh(account);
        }
        if (this._isOwnPublic(mesh)) {
            void this._followAgentCopies();
        }
        this._notifyStatus();
    }
    _onMeshDead(mesh, err) {
        if (this.closing || !this._isPooled(mesh))
            return;
        this._log?.error(['p2p', 'mesh'], 'mesh autobee died - retiring it', err);
        if (this._isAccount(mesh)) {
            this._statusError = statusErrorMessage(MESH_DIED, err);
        }
        this._retirePooledMesh(mesh).catch((retireErr) => {
            this._log?.warn(['p2p', 'mesh'], 'retiring the dead mesh failed', retireErr);
        });
        this._notifyStatus();
    }
    _onMeshStalled(mesh, err) {
        if (this._isPooled(mesh)) {
            this._withdrawFromMesh(mesh, err);
        }
    }
    _wireMesh(entry) {
        if (entry.handlers)
            return;
        const { mesh } = entry;
        if (this._isForeign(mesh)) {
            this._wireForeign(entry);
            return;
        }
        if (mesh.role === 'project' || this._isOwnPublic(mesh)) {
            mesh.pickedFrom = () => this._workspaceOf(mesh);
        }
        const handlers = {
            writable: () => this._onMeshWritable(mesh),
            dead: (err) => this._onMeshDead(mesh, err),
            stalled: (err) => this._onMeshStalled(mesh, err),
            peer: () => this._notifyStatus()
        };
        entry.handlers = handlers;
        mesh.on('kicked', () => this._onKicked(mesh));
        mesh.on('unattested-device', () => void this._settleMembership(mesh));
        if (mesh.writable) {
            this._onMeshSeedDue(mesh);
            this._onProjectWritable(mesh);
            this._onSharedWritable(mesh);
        }
        mesh.on('skill-secrets-dirty', () => {
            if (this._isAccount(mesh)) {
                void this._followSkillSecrets();
            }
        });
        mesh.on('members-dirty', () => void this._deviceControl.revalidate());
        mesh.on('members-dirty', () => {
            if (mesh.role !== 'workspace')
                return;
            this._notifySenders();
            const warn = (what) => (err) => this._log?.warn(['p2p', 'mesh'], `${what} after a workspace change failed`, err);
            this._cascadeRemovals(mesh).catch(warn('taking removed members out of projects'));
            this._dropUnpairedSiblings(mesh).catch(warn('unpairing a kicked device'));
        });
        mesh.on('agents-dirty', () => {
            if (mesh.role === 'workspace' || mesh.role === 'project' || this._isOwnPublic(mesh)) {
                void this._followSharedAgents();
            }
            if (mesh.role === 'workspace') {
                void this._sealProjectKeys();
                void this._followHosting();
            }
            if (this._isAccount(mesh)) {
                void this._followAgentCopies();
                void this._followSharedAgents();
                for (const listener of [...this._agentListeners]) {
                    listener();
                }
            }
        });
        mesh.on('members-dirty', () => {
            if (!this._isAccount(mesh))
                return;
            void this._followAccountName(mesh);
            void this._revokeInMeshes();
        });
        mesh.on('meshes-dirty', (changed, groupsChanged = false) => {
            if (changed || entry.meshesPending) {
                void this._followJoinedMeshes(mesh);
            }
            if (changed && mesh.role === 'workspace') {
                void this._followProjects(mesh);
                void this._followHosting();
            }
            if (mesh.role === 'project') {
                void this._followUpgrade(mesh);
            }
            if ((changed || groupsChanged) && mesh.role === 'workspace') {
                this._followGroups(mesh);
            }
            if (this._isAccount(mesh) && (changed || !this._publicMesh())) {
                void this._followPublicMesh(mesh);
            }
        });
        mesh.on('joined', () => {
            if (entry.meshesPending) {
                void this._followJoinedMeshes(mesh);
            }
        });
        mesh.on('membership-tallied', () => this._notifyStatus());
        mesh.on('mesh-named', () => {
            void this._keepName(mesh);
            this._notifyStatus();
        });
        mesh.on('membership', (membership) => {
            void this._recordMemberProof(mesh, membership);
            void this._followJoinedMeshes(mesh);
            if (mesh.role === 'workspace') {
                void this._followProjects(mesh);
                this._shareMemberKey(mesh);
                void this._followHosting();
            }
            void this._followPublicMesh(mesh);
        });
        this._listenMesh(mesh, handlers);
        this._startMeshServices(entry);
        this._startEntryIndexing(entry);
    }
    _listenMesh(mesh, handlers) {
        mesh.autobee.on('writable', handlers.writable);
        mesh.autobee.on('error', handlers.dead);
        mesh.autobee.on('close', handlers.dead);
        mesh.autobee.on('interrupt', handlers.stalled);
        mesh.autobee.local.on('peer-add', handlers.peer);
        mesh.autobee.local.on('peer-remove', handlers.peer);
    }
    _wireForeign(entry) {
        const { mesh } = entry;
        const handlers = {
            writable: () => this._notifyStatus(),
            dead: (err) => this._onMeshDead(mesh, err),
            stalled: (err) => this._onMeshStalled(mesh, err),
            peer: () => this._notifyStatus()
        };
        entry.handlers = handlers;
        mesh.on('agents-dirty', () => {
            this._notifyStatus();
            void this._followHosting();
        });
        this._listenMesh(mesh, handlers);
        this._startMeshServices(entry);
    }
    async _adoptAccount(mesh) {
        if (this._candidateMesh === mesh) {
            this._candidateMesh = null;
        }
        await this.local.setAccountMesh(this._requireDeviceKeyPair().publicKey, mesh.key);
        this._wireMesh(this._poolEntry(mesh));
        this._accountId = this._meshIdOf(mesh);
        void this._deviceControl.revalidate();
        this._statusError = null;
        this._upgradeRequired = null;
        if (mesh.writable) {
            this._kicked = false;
        }
        this._notifyStatus();
        void this._followPublicMesh(mesh);
        void this._followSkillSecrets();
    }
    _publicMesh(workspaceId = this._accountId) {
        return this._pooled(this._publicIdOf(workspaceId));
    }
    _publicIdOf(meshId) {
        const workspaceId = meshId !== null && meshId === this._accountId ? this._ownWorkspaceId : meshId;
        return workspaceId === null ? null : (this._publicIds.get(workspaceId) ?? null);
    }
    _workspaceOfPublic(meshId) {
        for (const [workspaceId, publicId] of this._publicIds) {
            if (publicId !== meshId)
                continue;
            return workspaceId === this._ownWorkspaceId ? (this._accountId ?? workspaceId) : workspaceId;
        }
        return meshId;
    }
    _isForeign(mesh) {
        return mesh.foreign;
    }
    _isOwnPublic(mesh) {
        return mesh.role === 'public' && !mesh.foreign;
    }
    async _sharePublicSeed(workspace, hostDeviceId) {
        requireWorkspace(workspace, this._meshIdOf(workspace));
        const account = this._accountMesh();
        const key = account && (await publicMeshKey(account, workspace.key));
        if (!account || !key) {
            throw new CoreError('PUBLIC_MESH_UNKNOWN');
        }
        const memberId = workspace.ourMemberId;
        if (!memberId) {
            return;
        }
        const held = await readPublicSeed(workspace.view, memberId, hostDeviceId);
        if (held && b4a.equals(held.publicMeshKey, key)) {
            return;
        }
        await workspace.dispatch('put-public-seed', {
            memberId,
            deviceId: hostDeviceId,
            publicMeshKey: key,
            sealedSeed: sealToDevice(publicSeed(account.seed, workspace.key), hostDeviceId)
        });
    }
    async _shareProjectSeed(batch, { workspace, project, agent, picking }) {
        const projectId = project.key;
        const seed = await this._heldProjectSeed(workspace, projectId);
        const sealing = seed && { projectId, seed, project: project.view, picking };
        const due = sealing && (await dueProjectHostKey(workspace.view, agent, sealing));
        if (due) {
            batch.dispatch('put-project-host-key', due);
        }
    }
    _shareMemberKey(workspace) {
        const write = (this._memberKeyWrites.get(workspace) ?? Promise.resolve())
            .then(() => this._writeMemberKey(workspace))
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'sharing our member key failed', err);
            }
        });
        this._memberKeyWrites.set(workspace, write);
    }
    async _writeMemberKey(workspace) {
        const account = this._accountMesh();
        const memberId = workspace.ourMemberId;
        if (workspace.role !== 'workspace' || workspace.closing || !workspace.writable) {
            return;
        }
        if (!memberId || !account) {
            return;
        }
        const boxKey = memberBoxKeyPair(account.seed).publicKey;
        const held = await readMemberKey(workspace.view, memberId);
        if (held && b4a.equals(held.boxKey, boxKey)) {
            return;
        }
        await workspace.dispatch('put-member-key', { memberId, boxKey });
    }
    _contentMesh() {
        return this._publicMesh() ?? this._accountMesh();
    }
    _devicesOf(mesh) {
        return this._isOwnPublic(mesh) ? (this._accountMesh() ?? mesh) : mesh;
    }
    _hasPublic(mesh) {
        return this._isAccount(mesh) || (mesh.role === 'workspace' && this._isPooled(mesh));
    }
    async _publicOf(scope, { follow = false } = {}) {
        const workspaceId = this._meshIdOf(scope);
        const held = this._publicMesh(workspaceId);
        if (held) {
            return held;
        }
        const account = this._accountMesh();
        if (account) {
            await this._followPublicMesh(account);
        }
        const opened = this._publicMesh(workspaceId);
        if (opened || !follow || this.closing) {
            return opened ?? scope;
        }
        return new Promise((resolve) => {
            const settle = () => {
                const mesh = this._publicMesh(workspaceId);
                if (mesh || this.closing || !this._hasPublic(scope)) {
                    this._publicWaiters.delete(settle);
                    resolve(mesh ?? scope);
                }
            };
            this._publicWaiters.add(settle);
        });
    }
    async _followPublicMesh(account) {
        if (this.closing || !this._isAccount(account)) {
            return;
        }
        if (!(await this._publicFollow.lock())) {
            return;
        }
        try {
            if (!this.closing && this._isAccount(account)) {
                await this._settlePublicMeshes(account);
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'following the public meshes failed', err);
            }
        }
        finally {
            this._publicFollow.unlock();
        }
    }
    async _publicWorkspaces(account) {
        const keys = [];
        const ours = account.ourMemberId;
        if (!ours) {
            return keys;
        }
        for await (const joined of account.view.find(JOINED_MESHES)) {
            const { meshKey } = joined;
            const live = joined.workspace && !joined.leftAt && b4a.equals(joined.memberId, ours);
            if (live && (await account.view.get(MESH_SEEDS, { meshKey }))) {
                keys.push(meshKey);
            }
        }
        return keys;
    }
    async _settlePublicMeshes(account) {
        try {
            await this._settleOwnWorkspace(account);
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'settling your own workspace failed', err);
            }
        }
        const workspaces = await this._publicWorkspaces(account);
        for (const workspaceKey of workspaces) {
            if (this.closing || !this._isAccount(account))
                return;
            try {
                await this._settlePublicMesh(account, workspaceKey);
            }
            catch (err) {
                if (!this.closing) {
                    this._log?.warn(['p2p', 'mesh'], 'following a public mesh failed', err);
                }
            }
        }
        await this._retireLeftPublic(account, workspaces);
    }
    async _settleOwnWorkspace(account) {
        const { own, lost } = await ownWorkspaces(account);
        if (own && account.writable) {
            for (const joined of lost) {
                this._carryLostMint(account, { own, joined });
            }
        }
        const mints = account.minted || !(await bornUnderRules(account.view));
        if (own || !mints) {
            this._setOwnWorkspace(own ? b4a.toHex(own) : null);
            return;
        }
        await this._mintOwnWorkspace(account);
    }
    async _mintOwnWorkspace(account) {
        const seed = ownWorkspaceSeed(account.seed);
        const recorded = (await this.local.listMeshes()).some((row) => b4a.equals(row.seed, seed));
        if (recorded || !account.writable || !account.ourMemberId) {
            return;
        }
        const workspace = { name: await this._defaultWorkspaceName(account) };
        this._setOwnWorkspace(await this._mintMesh({ shared: false, workspace, registry: account, seed }));
    }
    _setOwnWorkspace(workspaceId) {
        if (this._ownWorkspaceId !== workspaceId) {
            this._ownWorkspaceId = workspaceId;
            this._notifyStatus();
        }
    }
    async _retireLeftPublic(account, workspaces) {
        if (!account.ourMemberId || !this._isAccount(account)) {
            return;
        }
        const listed = new Set(workspaces.map((key) => b4a.toHex(key)));
        for (const [workspaceId, publicId] of [...this._publicIds]) {
            if (listed.has(workspaceId)) {
                continue;
            }
            const held = this._pooled(publicId);
            this._publicIds.delete(workspaceId);
            const carried = held?.workspaceKey && (await this._publicRecord(account, held.workspaceKey))?.key;
            if (held && !carried) {
                await this._teardownMesh(held);
            }
        }
        for (const workspaceKey of await this._leftWorkspaces(account)) {
            this._carryLeftPublic(account, workspaceKey);
        }
    }
    async _leftWorkspaces(account) {
        const ours = account.ourMemberId;
        const keys = [];
        for await (const joined of account.view.find(JOINED_MESHES)) {
            const left = joined.workspace && joined.leftAt && ours && b4a.equals(joined.memberId, ours);
            if (left && (await this._publicRecord(account, joined.meshKey))?.key) {
                keys.push(joined.meshKey);
            }
        }
        return keys;
    }
    _carryLostMint(account, { own: ownKey, joined }) {
        const lostId = b4a.toHex(joined.meshKey);
        if (this._ownCarries.has(lostId)) {
            return;
        }
        const carry = (async () => {
            const lost = await this._heldMesh(joined.meshKey);
            const own = lost && (await this._heldMesh(ownKey));
            if (!lost || !own) {
                return;
            }
            await own.waitForWritable();
            if (!this._isAccount(account) || !this._isPooled(own) || !this._isPooled(lost)) {
                return;
            }
            await lost.autobee.update();
            await this._carryProjects(account, { lost, own }, joined.memberId);
            if (!joined.leftAt) {
                await this._releaseJoinedMesh(joined.meshKey, account);
            }
            this._log?.info(['p2p', 'mesh'], 'carried a lost mint of your own workspace into the winner', {
                lost: lostId.slice(0, 8),
                winner: this._meshIdOf(own).slice(0, 8)
            });
            await this._teardownMesh(lost);
        })()
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'carrying a lost mint of your own workspace failed', err);
            }
        })
            .finally(() => {
            this._ownCarries.delete(lostId);
        });
        this._ownCarries.set(lostId, carry);
    }
    async _carryProjects(account, mints, ours) {
        const { lost, own } = mints;
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const rows = await lost.view.find(PROJECTS).toArray();
        for (const row of rows.filter((listed) => listedProject(listed, ours))) {
            const session = await this.local.readMeshSession(row.id);
            const seed = session?.seed ?? (await this._ownProjectSeed(lost, row.id));
            if (!seed) {
                continue;
            }
            const { createdAt, updatedAt } = row;
            await this._listProject(own, { key: row.id, seed }, { createdAt, updatedAt });
            if (session && (await this._isProjectOf(lost.key, row.id))) {
                await this.local.recordMesh(row.id, { ...session, workspaceKey: own.key }, { deviceId });
            }
            await this._carryAgentUsers(account, mints, row.id);
        }
    }
    async _carryAgentUsers(account, { lost, own }, projectId) {
        const batch = own.batch();
        for (const { agentId, userId } of await lost.view.find(AGENT_USERS).toArray()) {
            if (!b4a.equals(userId, projectId) || !(await liveSharedAgent(lost, agentId))) {
                continue;
            }
            try {
                await shareAgent(account, own, agentId);
            }
            catch (err) {
                if (!(err instanceof CoreError)) {
                    throw err;
                }
                this._log?.warn(['p2p', 'mesh'], 'a lost mint kept a shared agent the winner refuses', {
                    agentId,
                    code: err.code
                });
                continue;
            }
            if (!(await own.view.get(AGENT_USERS, { agentId, userId }))) {
                batch.dispatch('put-agent-user', { agentId, projectId });
            }
        }
        await batch.flush();
    }
    _carryLeftPublic(account, workspaceKey) {
        const workspaceId = b4a.toHex(workspaceKey);
        if (this._publicCarries.has(workspaceId)) {
            return;
        }
        const carry = (async () => {
            const record = await this._publicRecord(account, workspaceKey);
            const into = record?.key ? await this._publicOf(account, { follow: true }) : null;
            if (!record?.key || !into || into === account) {
                return;
            }
            const from = this._pooled(record.key) ?? (await this._openPublicMesh(account, { workspaceKey, record }));
            await into.waitForWritable();
            if (!this._isAccount(account) || !this._isPooled(into) || !this._isPooled(from)) {
                return;
            }
            const deviceId = this._requireDeviceKeyPair().publicKey;
            const unlinkProjects = !(await onOwnSeed(account, workspaceKey));
            await copyContent({ from, into, deviceId, unlinkProjects });
            await this.local.deleteAll([publicRecordKey(account.key, workspaceKey)]);
            this._log?.info(['p2p', 'mesh'], "copied a left workspace's private chats into your own", {
                workspace: workspaceId.slice(0, 8),
                into: this._meshIdOf(into).slice(0, 8)
            });
            await this._teardownMesh(from);
        })()
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], "copying a left workspace's chats failed", err);
            }
        })
            .finally(() => {
            this._publicCarries.delete(workspaceId);
        });
        this._publicCarries.set(workspaceId, carry);
    }
    async _settlePublicMesh(account, workspaceKey) {
        const workspaceId = b4a.toHex(workspaceKey);
        const key = await publicMeshKey(account, workspaceKey);
        const recorded = await this._publicRecord(account, workspaceKey);
        let record = recorded;
        let held = this._publicMesh(workspaceId);
        if (!held && record?.key) {
            held = await this._openPublicMesh(account, { workspaceKey, record });
        }
        else if (!held && key) {
            record = { ...freshPublicRecord(record?.migrated), key: b4a.toHex(key) };
            held = await this._openPublicMesh(account, { workspaceKey, record });
        }
        else if (!held) {
            const founder = this._localDevice ? await this._memberIn(account) : null;
            if (!account.writable || (this._localDevice && !founder)) {
                return;
            }
            record = freshPublicRecord(record?.migrated);
            held = await this._openPublicMesh(account, { workspaceKey, record, founder });
            record = { ...record, key: this._meshIdOf(held) };
        }
        if (!this._isAccount(account)) {
            await this._retirePooledMesh(held);
            return;
        }
        if (record && record !== recorded) {
            await this._savePublicRecord(account, workspaceKey, record);
        }
        if (this._publicIds.get(workspaceId) !== this._meshIdOf(held)) {
            this._publicIds.set(workspaceId, this._meshIdOf(held));
            this._notifyStatus();
        }
        if (!key && account.writable) {
            await account.dispatch('put-public-mesh', { id: workspaceId, meshKey: held.key });
        }
        else if (key && !b4a.equals(key, held.key)) {
            this._mergeLostMint(account, held, key);
        }
        if (workspaceId === this._ownWorkspaceId) {
            this._migrateIntoPublic(account, workspaceKey);
        }
    }
    async _publicRecord(account, workspaceKey) {
        const value = await this.local.get(publicRecordKey(account.key, workspaceKey));
        return isPublicRecord(value) ? value : null;
    }
    _savePublicRecord(account, workspaceKey, record) {
        return this.local.set(publicRecordKey(account.key, workspaceKey), record);
    }
    async _openPublicMesh(account, { workspaceKey, record, founder = null }) {
        const session = {
            seed: publicSeed(account.seed, workspaceKey),
            baseKey: record.key ? b4a.from(record.key, 'hex') : undefined,
            writerSeed: record.writerSeed
        };
        const mesh = this._newMesh(session, 'public');
        mesh.workspaceKey = workspaceKey;
        const deviceId = this._requireDeviceKeyPair().publicKey;
        try {
            await mesh.ready();
            if (session.baseKey && mesh.localLength === 0) {
                const claim = async () => this._knownBirthMember(mesh, deviceId, await this._memberIn(account));
                void this._appendJoinLater(mesh, claim);
            }
            else if (!session.baseKey) {
                await this._mintPublicBirth(mesh, founder);
            }
        }
        catch (err) {
            await mesh.close().catch(noop);
            throw err;
        }
        this._publicWriters.set(mesh, { ...record, key: this._meshIdOf(mesh) });
        this._wireMesh(this._poolEntry(mesh));
        this._bringMeshOnline(mesh, { announce: false, new: !session.baseKey });
        this._log?.info(['p2p', 'mesh'], 'public mesh opened', {
            mesh: this._meshIdOf(mesh).slice(0, 8),
            workspace: b4a.toHex(workspaceKey).slice(0, 8),
            minted: !session.baseKey,
            writable: mesh.writable
        });
        return mesh;
    }
    async _mintPublicBirth(mesh, founder) {
        const member = founder && {
            member: {
                id: founder.id,
                name: founder.name,
                joinedAt: Date.now(),
                updatedAt: founder.updatedAt
            },
            proof: founder.proof
        };
        await raceResource(mesh.autobee, mesh.appendBirthOp(this._requireDeviceKeyPair(), this._localDevice ?? undefined, {
            member: member ?? undefined,
            defaults: false
        }), 'mesh');
    }
    _mergeLostMint(account, lost, winnerKey) {
        const workspaceKey = lost.workspaceKey;
        const workspaceId = workspaceKey && b4a.toHex(workspaceKey);
        if (!workspaceKey || !workspaceId || this._publicMerges.has(workspaceId)) {
            return;
        }
        const merge = (async () => {
            const winnerId = b4a.toHex(winnerKey);
            const record = { ...freshPublicRecord(), key: winnerId };
            const winner = this._pooled(winnerId) ?? (await this._openPublicMesh(account, { workspaceKey, record }));
            await winner.waitForWritable();
            if (!this._isAccount(account) || !this._isPooled(winner) || !this._isPooled(lost)) {
                return;
            }
            this._publicIds.set(workspaceId, this._meshIdOf(winner));
            this._notifyStatus();
            await this._publicMigration;
            await copyContent({
                from: lost,
                into: winner,
                deviceId: this._requireDeviceKeyPair().publicKey
            });
            const writer = this._publicWriters.get(winner) ?? { ...freshPublicRecord(), key: winnerId };
            const migrated = (await this._publicRecord(account, workspaceKey))?.migrated ?? false;
            await this._savePublicRecord(account, workspaceKey, { ...writer, migrated });
            this._log?.info(['p2p', 'mesh'], 'merged a public mesh minted in a race into the winner', {
                lost: this._meshIdOf(lost).slice(0, 8),
                winner: this._meshIdOf(winner).slice(0, 8)
            });
            await this._teardownMesh(lost);
        })()
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'merging a lost public mesh failed', err);
            }
        })
            .finally(() => {
            this._publicMerges.delete(workspaceId);
        });
        this._publicMerges.set(workspaceId, merge);
    }
    _migrateIntoPublic(account, workspaceKey) {
        if (this._publicMigration)
            return;
        this._publicMigration = (async () => {
            const record = await this._publicRecord(account, workspaceKey);
            const into = this._publicMesh(b4a.toHex(workspaceKey));
            if (!record || record.migrated || !into) {
                return;
            }
            await into.waitForWritable();
            if (!this._isAccount(account) || !this._isPooled(into)) {
                return;
            }
            await copyContent({ from: account, into, deviceId: this._requireDeviceKeyPair().publicKey });
            const latest = (await this._publicRecord(account, workspaceKey)) ?? record;
            await this._savePublicRecord(account, workspaceKey, { ...latest, migrated: true });
            this._log?.info(['p2p', 'mesh'], 'copied the account into its public mesh', {
                mesh: this._meshIdOf(into).slice(0, 8)
            });
        })()
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'copying the account into its public mesh failed', err);
            }
        })
            .finally(() => {
            this._publicMigration = null;
        });
    }
    async _followAgentCopies(agentId) {
        if (!agentId && !(await this._agentCopies.lock()))
            return;
        try {
            const account = this._accountMesh();
            for (const { mesh } of [...this._meshes.values()]) {
                if (!account || this.closing)
                    return;
                if (this._isOwnPublic(mesh) && mesh.writable && !mesh.closing) {
                    await followAgentCopies(account, mesh, { deviceId: this.devicePublicKey, agentId });
                }
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'following the agent copies failed', err);
            }
        }
        finally {
            if (!agentId) {
                this._agentCopies.unlock();
            }
        }
    }
    async _keepAgentCopies(agent) {
        for (const { mesh } of [...this._meshes.values()]) {
            if (this._isOwnPublic(mesh) && mesh.writable && !mesh.closing) {
                await keepCopyChats(mesh, agent, this.devicePublicKey);
            }
        }
    }
    _agentPicks() {
        return {
            pick: async (into, agentId, refusal) => {
                const scope = {
                    account: this._accountMesh(),
                    workspace: await this._workspaceOf(into),
                    sharePublicSeed: (workspace, hostDeviceId) => this._sharePublicSeed(workspace, hostDeviceId),
                    shareProjectSeed: (batch, seal) => this._shareProjectSeed(batch, seal)
                };
                await pickAgent(scope, { into, agentId, refusal });
            },
            unpick: async (into, agentId) => {
                const workspace = await this._workspaceOf(into);
                if (workspace) {
                    await unpickAgent(workspace, into, agentId);
                }
            }
        };
    }
    async _workspaceOf(mesh) {
        let id = null;
        if (mesh.role === 'project') {
            const key = (await this.local.meshRecord(mesh.key))?.workspaceKey;
            id = key ? b4a.toHex(key) : null;
        }
        else if (this._isOwnPublic(mesh)) {
            id = this._workspaceOfPublic(this._meshIdOf(mesh));
        }
        const workspace = this._pooled(id);
        return workspace?.role === 'workspace' ? workspace : null;
    }
    async _pickedInto(workspace) {
        const into = [];
        for (const { mesh } of [...this._meshes.values()]) {
            if (mesh.writable && !mesh.closing && (await this._workspaceOf(mesh)) === workspace) {
                into.push(mesh);
            }
        }
        return into;
    }
    async _followWorkspaceAgents(account, workspace) {
        await followSharedAgents(account, workspace);
        for (const into of await this._pickedInto(workspace)) {
            await followPickedAgents(workspace, into);
        }
    }
    async _followSharedAgents() {
        if (!(await this._sharedAgents.lock()))
            return;
        try {
            const account = this._accountMesh();
            for (const { mesh } of [...this._meshes.values()]) {
                if (!account || this.closing)
                    return;
                if (mesh.role === 'workspace' && mesh.writable && !mesh.closing) {
                    await this._followWorkspaceAgents(account, mesh);
                }
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'following the shared agents failed', err);
            }
        }
        finally {
            this._sharedAgents.unlock();
        }
    }
    async _followHosting() {
        if (!(await this._hosting.lock()))
            return;
        try {
            const wanted = await this._hostTargets();
            for (const [meshId, target] of wanted) {
                if (this.closing)
                    return;
                const pooled = this._pooled(meshId);
                if (!pooled || this._isForeign(pooled)) {
                    const mesh = pooled ?? (await this._openHostMesh(target));
                    this._hostMeshes.add(meshId);
                    await this._joinAsHost(mesh, target.agentIds);
                }
            }
            let released = false;
            for (const meshId of [...this._hostMeshes]) {
                if (wanted.has(meshId))
                    continue;
                await this._releaseHostMesh(meshId);
                released = true;
            }
            for (const { mesh } of released ? [...this._meshes.values()] : []) {
                if (mesh.role === 'workspace') {
                    void this._followProjects(mesh);
                }
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'following the meshes this device hosts in failed', err);
            }
        }
        finally {
            this._hosting.unlock();
        }
    }
    async _hostTargets() {
        const device = this._requireDeviceKeyPair();
        const wanted = new Map();
        for (const { mesh } of [...this._meshes.values()]) {
            if (mesh.role !== 'workspace' || mesh.closing)
                continue;
            for (const target of await hostTargets(mesh, device)) {
                const id = b4a.toHex(target.meshKey);
                const agentIds = [...(wanted.get(id)?.agentIds ?? []), ...target.agentIds];
                wanted.set(id, { ...target, agentIds });
            }
        }
        return wanted;
    }
    async _openHostMesh({ meshKey, seed, role }) {
        const key = hostRecordKey(meshKey);
        const held = await this.local.get(key);
        const record = isHostRecord(held) ? held : freshHostRecord();
        if (record !== held) {
            await this.local.set(key, record);
        }
        const session = { seed, baseKey: meshKey, writerSeed: record.writerSeed };
        const mesh = this._newMesh(session, role);
        mesh.foreign = true;
        try {
            await mesh.ready();
        }
        catch (err) {
            await mesh.close().catch(noop);
            throw err;
        }
        this._wireMesh(this._poolEntry(mesh));
        this._log?.info(['p2p', 'mesh'], 'opened a mesh to host agents in', {
            mesh: this._meshIdOf(mesh).slice(0, 8),
            role
        });
        return mesh;
    }
    async _releaseHostMesh(meshId, { replaced = false } = {}) {
        this._hostMeshes.delete(meshId);
        await this.local.deleteAll([hostRecordKey(b4a.from(meshId, 'hex'))]);
        const held = this._pooled(meshId);
        const left = !!held && (await this._leaveAsHost(held));
        if (!held || replaced || !left) {
            return this._teardownMesh(held ?? b4a.from(meshId, 'hex'));
        }
        void waitForDelivery(held)
            .then(async () => {
            if (!this.closing && this._pooled(meshId) === held && !this._hostMeshes.has(meshId)) {
                await this._teardownMesh(held);
            }
        }, noop)
            .catch((err) => {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'letting a hosted mesh go failed', err);
            }
        });
    }
    async _leaveAsHost(mesh) {
        if (!mesh.writable || !(await hostForWriter(mesh.view, mesh.localWriterKey))) {
            return false;
        }
        try {
            await mesh.dispatch('remove-writer', { writerKey: mesh.localWriterKey });
            await mesh.autobee.update();
            return true;
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'leaving a mesh hosted in failed', err);
            return false;
        }
    }
    async _joinAsHost(mesh, agentIds) {
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const sent = this._hostJoins.get(mesh) ?? new Set();
        this._hostJoins.set(mesh, sent);
        for (const agentId of agentIds) {
            if ((await hostState(mesh, agentId, deviceId)) !== 'due') {
                sent.delete(agentId);
            }
            else if (!sent.has(agentId)) {
                sent.add(agentId);
                this._appendAgentJoin(mesh, agentId, sent);
            }
        }
    }
    _appendAgentJoin(mesh, agentId, sent) {
        const claim = agentJoin(mesh, {
            device: this._requireDeviceKeyPair(),
            writerKey: mesh.localWriterKey,
            agentId,
            at: Date.now()
        });
        void mesh.dispatch('agent-join', claim, { optimistic: true }).catch((err) => {
            sent.delete(agentId);
            if (!mesh.closing) {
                this._log?.warn(['p2p', 'mesh'], 'appending an agent-join failed', err);
            }
        });
    }
    async _retirePublicMeshes() {
        this._publicIds.clear();
        this._ownWorkspaceId = null;
        const held = [...this._meshes.values()].filter(({ mesh }) => this._isOwnPublic(mesh));
        await Promise.all(held.map(({ mesh }) => this._retirePublicMesh(mesh)));
    }
    async _retirePublicMesh(mesh) {
        if (this._leftPublic.has(mesh)) {
            await this._teardownMesh(mesh).catch(noop);
        }
        else {
            await this._retirePooledMesh(mesh).catch(noop);
        }
    }
    async _leavePublicMesh(account) {
        for (const workspaceKey of await this._publicWorkspaces(account)) {
            const held = this._publicMesh(b4a.toHex(workspaceKey));
            if (held) {
                this._leftPublic.add(held);
                await this._announceDeparture(held);
            }
            const record = await this._publicRecord(account, workspaceKey);
            if (record) {
                await this.local.set(leftPublicRecordKey(account.key, workspaceKey), record);
                await this._savePublicRecord(account, workspaceKey, {
                    ...freshPublicRecord(record.migrated),
                    key: record.key
                });
            }
        }
    }
    _pooled(meshKey) {
        if (meshKey === null)
            return null;
        return this._meshes.get(meshKey)?.mesh ?? null;
    }
    async _isOurMemberDevice(deviceId) {
        const account = this._accountMesh();
        const ours = account?.ourMemberId;
        if (!account || !ours || account.closing) {
            return false;
        }
        const row = await account.view.get(DEVICES, { id: deviceId });
        return !!row && !row.revoked && !!row.memberId && b4a.equals(row.memberId, ours);
    }
    _accountMesh() {
        return this._pooled(this._accountId);
    }
    _meshIdOf(mesh) {
        return b4a.toHex(mesh.key);
    }
    _poolEntry(mesh) {
        const key = this._meshIdOf(mesh);
        const existing = this._meshes.get(key);
        if (existing?.mesh === mesh) {
            return existing;
        }
        const entry = {
            mesh,
            handlers: null,
            processingFiles: null,
            vectorIndex: null,
            memberLock: new ScopeLock({ debounce: true }),
            followLock: new ScopeLock({ debounce: true }),
            meshesPending: false
        };
        this._meshes.set(key, entry);
        mesh.on('peer-add', () => this._onMeshPeer(mesh));
        return entry;
    }
    async _meshForBlobCore(coreKey, blockOffset, meshKey) {
        for (const { mesh } of this._meshes.values()) {
            if (b4a.toHex(mesh.blobs.core.key) === coreKey)
                return mesh;
        }
        if (meshKey) {
            return this._pooled(b4a.toHex(meshKey));
        }
        if (blockOffset === undefined) {
            return null;
        }
        const indexed = await this.local.files.meshOf(b4a.from(coreKey, 'hex'), blockOffset);
        return indexed ? this._pooled(b4a.toHex(indexed)) : null;
    }
    _pendingUpdatesFor(mesh) {
        const logged = (what) => (err) => this._log?.warn(['p2p', 'mesh'], `${what} the pending view update failed`, err);
        return {
            read: async () => {
                const row = await this.local.readMeshUpdate(mesh().key);
                if (!row) {
                    return null;
                }
                const from = row.fromKey ? { key: row.fromKey, length: row.fromLength ?? 0 } : null;
                return { from, to: 0, incremental: !!row.incremental };
            },
            write: ({ from, incremental }) => this.local
                .writeMeshUpdate({
                meshKey: mesh().key,
                fromKey: from?.key,
                fromLength: from?.length,
                incremental
            })
                .catch(logged('writing')),
            clear: () => this.local.clearMeshUpdate(mesh().key).catch(logged('clearing'))
        };
    }
    _fileIndexFor(mesh) {
        const owner = () => ({ meshKey: mesh().key, ownCoreKey: mesh().blobs.core.key });
        const known = (chunks) => chunks.map((chunk) => knownFile(chunk, owner())).filter((file) => file !== null);
        return {
            record: (chunks) => this.local.files.record(known(chunks)),
            refresh: (chunks) => this.local.files.refresh(known(chunks)),
            read: (reference) => {
                const file = referencedFile(reference, owner());
                if (!file) {
                    return;
                }
                this.local.files
                    .read(file)
                    .catch((err) => this._log?.warn(['files'], 'recording a file read failed', err));
            },
            markCleared: async (blobId) => {
                const key = fileKeyOf(blobId, owner());
                if (key) {
                    await this.local.files.markCleared(key);
                }
            },
            list: () => this.local.files.list(mesh().key),
            retireChats: (purged) => this.local.files.retireChats(mesh().key, purged),
            forget: (file) => this.local.files.forget(file)
        };
    }
    async _indexMeshFiles(mesh) {
        try {
            if (mesh.openedEmpty) {
                await this.local.files.markBackfilled(mesh.key);
                return;
            }
            await mesh.autobee.update();
            if (await this.local.files.backfilled(mesh.key)) {
                return;
            }
            await backfillFileIndex(mesh);
            if (!mesh.closing) {
                await this.local.files.markBackfilled(mesh.key);
            }
        }
        catch (err) {
            if (!mesh.closing) {
                this._log?.warn(['files'], 'indexing the mesh files failed', err);
            }
        }
    }
    _syncMeshInBackground(mesh) {
        const key = backgroundSyncKey(mesh.key);
        const failed = (err) => {
            if (!mesh.closing) {
                this._log?.warn(['p2p', 'mesh'], 'background sync failed', err);
            }
        };
        mesh.on('background-synced', ({ length }) => {
            this.local.set(key, { viewLength: length }).catch(failed);
        });
        mesh.autobee.on('move-to', () => {
            this.local.deleteAll([key]).catch(failed);
            void mesh.syncInBackground();
        });
        this.local
            .get(key)
            .then((mark) => {
            if (mark === null && !mesh.closing) {
                void mesh.syncInBackground();
            }
        })
            .catch(failed);
    }
    _servedFile(mesh, coreKey, blockOffset) {
        this.local.files
            .touch({ meshKey: mesh.key, coreKey, blockOffset })
            .catch((err) => this._log?.warn(['files'], 'recording a file read failed', err));
    }
    async clearOldFiles({ olderThanMs, includeOwn = false }) {
        if (!this.opened)
            await this.ready();
        let cleared = 0;
        for (const file of await this.local.files.stale(Date.now() - olderThanMs)) {
            if (this.closing || this.suspended)
                break;
            if (file.own && !includeOwn)
                continue;
            const mesh = this._pooled(b4a.toHex(file.meshKey));
            if (!mesh) {
                continue;
            }
            const done = await mesh.files.clear(file.blobId, file.attachmentId ?? file.blobId);
            if (!done) {
                continue;
            }
            await this.local.files.markCleared(file);
            cleared++;
        }
        return cleared;
    }
    _startFileGc({ now = false } = {}) {
        const gc = this._fileGc;
        if (!gc || this._fileGcTimer || this.suspended) {
            return;
        }
        const run = () => {
            if (this._fileGcRun || this.closing || this.suspended)
                return;
            this._fileGcRun = this.clearOldFiles({ olderThanMs: gc.maxAgeMs, includeOwn: gc.includeOwn });
            this._fileGcRun
                .then((cleared) => this._log?.info(['files'], 'cleared files not read lately', { cleared }))
                .catch((err) => this._log?.warn(['files'], 'clearing old files failed', err))
                .finally(() => (this._fileGcRun = null));
        };
        this._fileGcTimer = setInterval(run, gc.intervalMs ?? FILE_GC_INTERVAL_MS);
        unref(this._fileGcTimer);
        if (now) {
            run();
        }
    }
    async _stopFileGc() {
        if (this._fileGcTimer) {
            clearInterval(this._fileGcTimer);
        }
        this._fileGcTimer = null;
        await this._fileGcRun?.catch(noop);
    }
    _linkAttachment(attachment, mesh) {
        return this._blobServer?.link(attachment, mesh) ?? null;
    }
    _isPooled(mesh) {
        return !mesh.closing && this._meshes.get(this._meshIdOf(mesh))?.mesh === mesh;
    }
    _isAccount(mesh) {
        return this._accountMesh() === mesh;
    }
    _unpoolMesh(mesh) {
        const key = this._meshIdOf(mesh);
        const entry = this._meshes.get(key);
        let wasAccount = false;
        if (entry?.mesh === mesh) {
            this._unwireMesh(entry);
            this._meshes.delete(key);
            wasAccount = this._accountId === key;
        }
        if (this._candidateMesh === mesh) {
            this._candidateMesh = null;
        }
        if (wasAccount) {
            void this._deviceControl.revalidate();
            this._notifyStatus();
        }
    }
    _unwireMesh(entry) {
        if (!entry.handlers)
            return;
        entry.mesh.autobee.off('writable', entry.handlers.writable);
        entry.mesh.autobee.off('error', entry.handlers.dead);
        entry.mesh.autobee.off('close', entry.handlers.dead);
        entry.mesh.autobee.off('interrupt', entry.handlers.stalled);
        entry.mesh.autobee.local.off('peer-add', entry.handlers.peer);
        entry.mesh.autobee.local.off('peer-remove', entry.handlers.peer);
    }
    async _awaitMesh() {
        if (this.closing)
            return null;
        if (!this.opened)
            await this.ready();
        return this._accountMesh();
    }
    _startMeshServices(entry) {
        const { mesh } = entry;
        const deviceId = this._requireDeviceKeyPair().publicKey;
        void mesh.refreshMembership().catch((error) => {
            this._log?.warn(['p2p', 'mesh'], 'tallying membership failed', error);
        });
        void mesh
            .refreshName()
            .then(() => {
            void this._keepName(mesh);
            this._notifyStatus();
        })
            .catch((error) => this._log?.warn(['p2p', 'mesh'], 'reading the mesh name failed', error));
        this._syncMeshInBackground(mesh);
        if (inRole(mesh.role, '@qvac/put-chat') && !this._isForeign(mesh)) {
            this._startContentServices(entry, deviceId);
        }
    }
    _startContentServices(entry, deviceId) {
        const { mesh } = entry;
        mesh.on('notification', (event) => this.emit('notification', event));
        const build = () => rebuildChatOrder(mesh, this.local)
            .then((gone) => {
            void retireGoneChats(mesh, this.local, gone).catch((error) => this._log?.warn(['p2p', 'mesh'], 'retiring gone chats failed', error));
        })
            .catch((error) => this._log?.warn(['p2p', 'mesh'], 'building the chat order failed', error));
        let built = build();
        mesh.chatOrderBuilt = built;
        mesh.syncChatOrder = async (chatIds) => {
            await built;
            await refreshChatOrder(mesh, this.local, chatIds);
        };
        mesh.on('landed', () => {
            built = built.then(build);
            mesh.chatOrderBuilt = built;
        });
        mesh.on('chat-tombstone', (chatId, deletedAt) => {
            void this.local
                .clearChatNotify(chatId)
                .catch((error) => this._log?.warn(['p2p', 'mesh'], 'chat-tombstone notification reclaim failed', error));
            void removeChatAttachments(mesh, chatId, { deviceId, at: deletedAt }).catch((error) => this._log?.warn(['p2p', 'mesh'], 'chat-tombstone attachment reclaim failed', error));
            void removeChatKnowledge(mesh, chatId, deletedAt).catch((error) => this._log?.warn(['p2p', 'mesh'], 'chat-tombstone knowledge reclaim failed', error));
            void this._inferenceCalls
                ?.forget(chatId)
                .catch((error) => this._log?.warn(['p2p', 'mesh'], 'chat-tombstone inspector reclaim failed', error));
        });
        const reclaimLock = new ScopeLock({ debounce: true });
        const reclaim = async () => {
            if (!(await reclaimLock.lock()))
                return;
            try {
                if (!mesh.closing) {
                    await mesh.files.reclaimPurged();
                }
            }
            catch (error) {
                this._log?.warn(['p2p', 'mesh'], 'purged file reclaim failed', error);
            }
            finally {
                reclaimLock.unlock();
            }
        };
        mesh.on('chat-purged', () => void reclaim());
        mesh.on('landed', () => void reclaim());
        const sweepLock = new ScopeLock({ debounce: true });
        const sweep = async () => {
            if (!(await sweepLock.lock()))
                return;
            try {
                if (!mesh.closing) {
                    await mesh.files.sweepTombstones(deviceId);
                }
            }
            catch (error) {
                this._log?.warn(['p2p', 'mesh'], 'blob sweep failed', error);
            }
            finally {
                sweepLock.unlock();
            }
        };
        void this._indexMeshFiles(mesh).then(() => Promise.all([reclaim(), sweep()]));
        mesh.autobee.on('move-to', () => void sweep());
    }
    async _discardCandidateMesh() {
        const candidate = this._candidateMesh;
        if (!candidate) {
            return;
        }
        this._candidateMesh = null;
        if (this._swarm) {
            await this._swarm.leave(candidate.discoveryKey).catch(noop);
        }
        await candidate.close().catch(noop);
    }
    async _recordDeparture(mesh) {
        const pending = !mesh.writable && (mesh.localLength > 0 || mesh.joining);
        if (pending || (await this._departureHasAudience(mesh))) {
            await this.local.recordDeparture(mesh.key, { creator: mesh.minted });
        }
        await this._announceDeparture(mesh);
    }
    async _departureHasAudience(mesh) {
        if (!mesh.writable)
            return false;
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const snap = mesh.view.snapshot();
        try {
            for await (const device of snap.find(DEVICES)) {
                if (!device.revoked && !b4a.equals(device.id, deviceId))
                    return true;
            }
            return false;
        }
        finally {
            await snap.close();
        }
    }
    async _announceDeparture(mesh = this._accountMesh(), strict = false) {
        if (!mesh?.writable) {
            if (strict) {
                throw new Error('Mesh departure requires a writable source');
            }
            return;
        }
        try {
            await mesh.dispatch('remove-writer', {
                writerKey: mesh.localWriterKey,
                deviceId: this._requireDeviceKeyPair().publicKey,
                revokedAt: Date.now()
            });
            await mesh.autobee.update();
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'writer departure announcement failed', error);
            if (strict) {
                throw error;
            }
        }
    }
    async leaveMesh(meshId) {
        if (this.closing)
            return;
        if (!this.opened)
            await this.ready();
        if (this._leaving === meshId) {
            return;
        }
        if (this._leaving || this._minting) {
            throw new CoreError('MESH_TRANSITION_IN_PROGRESS');
        }
        const departing = await this._openPooledMesh(meshId);
        const account = this._accountMesh();
        if (account && isOwnWorkspace(account, departing)) {
            throw new CoreError('OWN_WORKSPACE_LEAVE_REFUSED');
        }
        const member = departing.role === 'workspace' ? await this._leavingMember(departing) : null;
        const leavingAccount = await this._isStoredAccount(departing);
        this._log?.info(['p2p', 'mesh'], 'leaving a mesh', {
            meshId: meshId.slice(0, 8),
            account: leavingAccount
        });
        this._leaving = meshId;
        this._notifyStatus();
        try {
            if (leavingAccount) {
                await this._departAllBut(departing);
                if (this.closing) {
                    return;
                }
            }
            if (leavingAccount) {
                await this._leavePublicMesh(departing);
            }
            if (member) {
                await this._leaveAsMember(departing, member);
            }
            await this._recordDeparture(departing);
            await this._releaseJoinedMesh(departing.key);
            if (!leavingAccount) {
                await this._teardownMesh(departing);
                this._departures?.flush();
                return;
            }
            await this._archiveMembership(departing);
            const landed = this._waitForMeshChange();
            this._requestFreshMesh().catch(noop);
            const error = await landed;
            if (error) {
                throw error;
            }
        }
        finally {
            this._leaving = null;
            this._notifyStatus();
        }
    }
    async leaveWorkspace(meshId) {
        if (!this.opened)
            await this.ready();
        requireWorkspace(await this._openPooledMesh(meshId), meshId);
        await this.leaveMesh(meshId);
    }
    async _leavingMember(workspace) {
        const ours = workspace.ourMemberId ?? (await workspace.refreshOurMember())?.memberId;
        if (!ours || !workspace.writable) {
            return null;
        }
        if (await lastAdminAmongOthers(workspace.view, ours)) {
            throw new CoreError('WORKSPACE_LAST_ADMIN');
        }
        return ours;
    }
    async _leaveAsMember(workspace, ours) {
        const rows = await workspace.view.find(PROJECTS).toArray();
        for (const { id } of rows.filter((row) => listedProject(row, ours))) {
            const project = (await this._isProjectOf(workspace.key, id)) ? await this._heldMesh(id) : null;
            if (project?.writable && (await inProject(project.view, ours))) {
                await project.dispatch('remove-member', { memberId: ours, revokedAt: Date.now() });
            }
            if (project) {
                await this._departKicked(project);
            }
            await workspace.dispatch('set-project-listing', {
                projectId: id,
                memberId: ours,
                removed: true
            });
        }
        await workspace.dispatch('remove-member', { memberId: ours, revokedAt: Date.now() });
    }
    async _heldMesh(key) {
        const meshId = b4a.toHex(key);
        const held = this._pooled(meshId);
        if (held || !(await this.local.readMeshSession(key))) {
            return held;
        }
        return this._openPooledMesh(meshId);
    }
    async _cascadeRemovals(workspace) {
        const ours = workspace.ourMemberId;
        if (this.closing || !ours || !workspace.writable) {
            return;
        }
        const rows = await workspace.view.find(PROJECTS).toArray();
        for (const row of rows.filter((listed) => listedProject(listed, ours))) {
            const project = this._pooled(b4a.toHex(row.id));
            if (project?.writable && (await this._isProjectOf(workspace.key, row.id))) {
                await this._dropFromProject(project, { workspace, row });
            }
        }
    }
    async _cascadeIntoProject(project) {
        for (const { mesh: workspace } of [...this._meshes.values()]) {
            if (this.closing || !project.writable)
                return;
            const ours = workspace.role === 'workspace' && workspace.writable && workspace.ourMemberId;
            const row = ours ? await workspace.view.get(PROJECTS, { id: project.key }) : null;
            if (ours &&
                row &&
                listedProject(row, ours) &&
                (await this._isProjectOf(workspace.key, row.id))) {
                await this._dropFromProject(project, { workspace, row });
            }
        }
    }
    async _dropFromProject(project, { workspace, row }) {
        for (const { memberId, at, kicked } of await departedMembers(workspace.view)) {
            const listed = listsMember(row, memberId);
            const member = await projectMember(project.view, memberId);
            if ((!kicked && listed) || (member?.addedAt ?? 0) > at) {
                continue;
            }
            if (member) {
                await project.dispatch('remove-member', { memberId, revokedAt: at });
            }
            if (listed) {
                await workspace.dispatch('set-project-listing', {
                    projectId: row.id,
                    memberId,
                    removed: true,
                    removedAt: at
                });
            }
        }
    }
    async _dropUnpairedSiblings(workspace) {
        const account = this._accountMesh();
        const ours = workspace.ourMemberId;
        const self = this._requireDeviceKeyPair().publicKey;
        const own = ours && (await workspace.view.get(DEVICES, { id: self }));
        if (this.closing || !ours || !own || own.revoked || !account?.writable) {
            return;
        }
        const devices = await workspace.view.find(DEVICES).toArray();
        const kicked = devices.filter((device) => device.revoked && ownedBy(device, ours) && (device.revokedAt ?? 0) > own.joinedAt);
        for (const device of kicked) {
            const row = await account.view.get(DEVICES, { id: device.id });
            const writerKey = row && !row.revoked ? row.writerKey : null;
            if (writerKey && (await removedBy(workspace.view, device)) === 'another-member') {
                await this.removeDeviceWriter(writerKey, device.id, account);
            }
        }
    }
    async _departAllBut(account) {
        const accountId = this._meshIdOf(account);
        const passes = [...this._following].filter(([meshId]) => meshId !== accountId);
        await Promise.allSettled(passes.map(([, pass]) => pass));
        const others = (await this.local.listMeshes()).filter((row) => !b4a.equals(row.key, account.key));
        await Promise.all(others.map((row) => this._departOnLogout(row.key)));
    }
    async _departOnLogout(key) {
        try {
            const mesh = await this._openPooledMesh(b4a.toHex(key));
            await this._teardownMesh(mesh, { depart: true });
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'departing a mesh on logout failed', error);
            if (this.closing) {
                return;
            }
            await this._teardownMesh(key).catch(noop);
        }
    }
    async _isStoredAccount(mesh) {
        const key = await this._storedAccountKey();
        return key !== undefined && b4a.equals(key, mesh.key);
    }
    async _storedAccountKey() {
        return (await this.local.accountMesh(this._requireDeviceKeyPair().publicKey))?.key;
    }
    listMeshes() {
        if (this._listing)
            return this._listing;
        const listing = this._readMeshList().finally(() => {
            if (this._listing === listing) {
                this._listing = null;
            }
        });
        this._listing = listing;
        return listing;
    }
    async _readMeshList() {
        if (!this.opened)
            await this.ready();
        const accountKey = await this._storedAccountKey();
        const rows = await this.local.listMeshes();
        const registry = accountKey ? this._pooled(b4a.toHex(accountKey)) : null;
        const meshes = registry ? await this._ownMeshes(registry) : new Map();
        return {
            meshes: await Promise.all(rows.map((row) => this._meshEntry(row, accountKey, meshes)))
        };
    }
    async listArchivedMeshes() {
        if (!this.opened)
            await this.ready();
        const rows = await this.local.listArchivedMeshes();
        return {
            meshes: rows.map((row) => ({
                meshId: b4a.toHex(row.key),
                leftAt: row.leftAt,
                wasAccount: row.wasHome,
                migratedAt: row.migratedAt
            }))
        };
    }
    async archivedMeshContents(meshId) {
        if (!this.opened)
            await this.ready();
        const row = await this._archivedRow(meshId);
        const key = await this._storedAccountKey();
        const account = key ? this._pooled(b4a.toHex(key)) : null;
        const counts = await this._withArchivedMesh(row, (mesh, archived) => countContents(mesh, account, archived));
        return { meshId, ...counts };
    }
    async migrateArchivedMesh(meshId) {
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            if (this.closing) {
                throw new CoreError('CORE_CLOSING', ['Core']);
            }
            const row = await this._archivedRow(meshId);
            if (row.migratedAt) {
                const none = { chats: 0, agents: 0, knowledge: 0 };
                return { meshId, migrated: false, migratedAt: row.migratedAt, ...none };
            }
            const account = await this._writableAccount();
            if (!account) {
                throw new CoreError('ACCOUNT_NOT_WRITABLE');
            }
            const into = await this._publicOf(account);
            const counts = await this._withArchivedMesh(row, (mesh, archived) => migrateContents(mesh, into, { from: archived, into: account }));
            const migratedAt = Date.now();
            await this.local.markMeshMigrated(row.key, migratedAt);
            return { meshId, migrated: true, migratedAt, ...counts };
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async _archivedRow(meshId) {
        const key = this._meshKeyOf(meshId);
        const row = (await this.local.listArchivedMeshes()).find((row) => b4a.equals(row.key, key));
        if (!row) {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        if (!row.wasHome) {
            throw new CoreError('ARCHIVE_NOT_ACCOUNT', [meshId]);
        }
        return row;
    }
    async _withArchivedMesh(row, fn) {
        const pooled = this._pooled(b4a.toHex(row.key));
        if (pooled) {
            return fn(pooled, pooled);
        }
        const publicRecord = async (workspaceKey) => {
            const record = (await this.local.get(leftPublicRecordKey(row.key, workspaceKey))) ??
                (await this.local.get(publicRecordKey(row.key, workspaceKey)));
            return isPublicRecord(record) ? record : null;
        };
        return withArchivedMesh(row, {
            store: this.store,
            storage: this.storage,
            deviceId: this._requireDeviceKeyPair().publicKey,
            logger: this._log,
            publicRecord
        }, fn);
    }
    async _ownMeshes(registry) {
        const meshes = new Map();
        const ours = registry.ourMemberId;
        if (!ours) {
            return meshes;
        }
        for await (const joined of registry.view.find(JOINED_MESHES)) {
            if (!joined.leftAt && b4a.equals(joined.memberId, ours)) {
                meshes.set(b4a.toHex(joined.meshKey), joined);
            }
        }
        return meshes;
    }
    async _isOwnMeshIn(registry, meshKey) {
        const ours = registry.ourMemberId;
        if (!ours) {
            return false;
        }
        const joined = await registry.view.get(JOINED_MESHES, { meshKey });
        return !!joined && !joined.leftAt && b4a.equals(joined.memberId, ours);
    }
    async setMeshLabel(meshId, label) {
        if (!this.opened)
            await this.ready();
        const meshKey = this._meshKeyOf(meshId);
        const registry = await this._writableAccount();
        if (!registry) {
            throw new CoreError('ACCOUNT_MESH_MISSING');
        }
        const ours = registry.ourMemberId;
        const joined = await registry.view.get(JOINED_MESHES, { meshKey });
        if (!ours || !joined || !b4a.equals(joined.memberId, ours)) {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        await registry.dispatch('put-joined-mesh', {
            room: {
                meshKey,
                memberId: ours,
                joinedAt: joined.joinedAt,
                leftAt: joined.leftAt,
                label,
                labeledAt: Math.max(Date.now(), (joined.labeledAt ?? 0) + 1),
                shared: joined.shared,
                sharedAt: joined.sharedAt
            }
        });
        this._notifyStatus();
    }
    async setMeshName(meshId, name) {
        if (!this.opened)
            await this.ready();
        const trimmed = name.trim();
        if (!meshNameWithinBounds(trimmed)) {
            throw new CoreError('MESH_NAME_TOO_LONG', [MAX_MESH_NAME_CHARS]);
        }
        const mesh = await requireMesh(this._meshPool(), meshId);
        if (this._isAccount(mesh)) {
            throw new CoreError('MESH_NAME_ACCOUNT_REFUSED');
        }
        if (mesh.role === 'workspace') {
            await requireOurAdmin(mesh, 'rename the workspace');
            if (!trimmed) {
                throw new CoreError('WORKSPACE_NAME_EMPTY');
            }
        }
        await mesh.setName(trimmed);
    }
    async createWorkspace({ name, icon } = {}) {
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            const registry = await this._writableAccount();
            if (!registry) {
                throw new CoreError('ACCOUNT_MESH_MISSING');
            }
            const named = name?.trim() || (await this._defaultWorkspaceName(registry));
            if (!meshNameWithinBounds(named)) {
                throw new CoreError('MESH_NAME_TOO_LONG', [MAX_MESH_NAME_CHARS]);
            }
            const workspace = { name: named, icon: icon || undefined };
            return await this._mintMesh({ shared: false, workspace, registry });
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async _defaultWorkspaceName(registry) {
        const ours = registry.ourMemberId;
        const member = ours ? await registry.view.get(MEMBERS, { id: ours }) : null;
        if (!member) {
            throw new CoreError('ACCOUNT_MEMBER_UNKNOWN');
        }
        return `${member.name}'s Workspace`.slice(0, MAX_MESH_NAME_CHARS);
    }
    async createMesh({ shared = false, compute = false } = {}) {
        if (compute) {
            throw new CoreError('COMPUTE_MESH_RETIRED');
        }
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            return await this._mintMesh({ shared });
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async createProject(workspaceId, { name }) {
        if (!this.opened)
            await this.ready();
        const named = projectName(name);
        await this._meshTransitionLock.lock();
        try {
            const workspace = await this._openPooledMesh(workspaceId);
            if (workspace.role !== 'workspace') {
                throw new CoreError('NOT_A_WORKSPACE', [workspaceId]);
            }
            if (!workspace.writable) {
                throw new CoreError('MESH_STILL_JOINING');
            }
            return await this._mintProject(workspace, named);
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async _mintProject(workspace, name) {
        const mesh = await this._openNewProject(workspace, { name });
        try {
            const now = Date.now();
            await this._listProject(workspace, mesh, { createdAt: now, updatedAt: now });
        }
        catch (error) {
            await this._discardMesh(mesh);
            throw error;
        }
        await mesh.refreshName();
        await this._keepName(mesh);
        this._notifyStatus();
        return this._meshIdOf(mesh);
    }
    async _listProject(workspace, project, listing) {
        const batch = workspace.batch();
        batch.dispatch('put-project', { project: { id: project.key, ...listing } });
        const ours = workspace.ourMemberId;
        const own = ours
            ? await dueProjectKey(workspace.view, ours, { projectId: project.key, seed: project.seed })
            : null;
        if (own) {
            batch.dispatch('put-project-key', own);
        }
        await batch.flush();
    }
    async _keepName(mesh) {
        const named = mesh.name;
        const id = b4a.toHex(mesh.key);
        const kept = this._meshNames.get(id);
        if (mesh.role !== 'project' || !named || (kept && kept.namedAt >= named.namedAt)) {
            return;
        }
        const row = { meshKey: mesh.key, name: named.name, namedAt: named.namedAt };
        this._meshNames.set(id, row);
        try {
            await this.local.keepMeshName(row);
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'keeping the project name failed', err);
        }
    }
    async _openNewProject(workspace, project) {
        if (this._leaving || this._minting) {
            throw new CoreError('MESH_TRANSITION_IN_PROGRESS');
        }
        const mesh = await this._openMesh({
            new: true,
            sharing: true,
            role: 'project',
            project,
            workspaceKey: workspace.key
        });
        this._wireMesh(this._poolEntry(mesh));
        this._bringMeshOnline(mesh, { new: true, announce: false });
        try {
            await mesh.refreshOurMember();
            if (!mesh.ourMemberId) {
                throw new CoreError('MESH_WITHOUT_MEMBER');
            }
        }
        catch (error) {
            await this._discardMesh(mesh);
            throw error;
        }
        return mesh;
    }
    async sharedMesh() {
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            const registry = await this._writableAccount();
            if (!registry) {
                throw new CoreError('ACCOUNT_MESH_MISSING');
            }
            const resolved = await this._resolveSharedMesh(registry);
            return resolved ?? { meshId: await this._mintMesh({ shared: true, registry }) };
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async _occupancyNotice(meshId) {
        const mesh = this._pooled(meshId);
        if (!mesh) {
            return undefined;
        }
        if (!mesh.ourMemberId) {
            await mesh.refreshOurMember();
        }
        const ours = mesh.ourMemberId;
        const snap = mesh.view.snapshot();
        try {
            for await (const member of snap.find(MEMBERS)) {
                if (!ours || !b4a.equals(member.id, ours))
                    return MESH_NOT_EMPTY;
            }
            for await (const _chunk of snap.find(CHUNKS, { limit: 1 })) {
                return MESH_NOT_EMPTY;
            }
            return undefined;
        }
        finally {
            await snap.close();
        }
    }
    async _resolveSharedMesh(registry) {
        const marked = [...(await this._ownMeshes(registry)).values()].filter((joined) => joined.shared);
        if (marked.length === 0) {
            return null;
        }
        marked.sort((a, b) => a.joinedAt - b.joinedAt || b4a.compare(a.meshKey, b.meshKey));
        const [winner, ...losers] = marked;
        for (const loser of losers) {
            await this._unmarkSharedMesh(registry, loser);
        }
        if (losers.length > 0) {
            this._notifyStatus();
        }
        return { meshId: b4a.toHex(winner.meshKey), notice: unmarkedNotice(losers) };
    }
    async _unmarkSharedMesh(registry, joined) {
        await registry.dispatch('put-joined-mesh', {
            room: {
                meshKey: joined.meshKey,
                memberId: joined.memberId,
                joinedAt: joined.joinedAt,
                label: joined.label,
                labeledAt: joined.labeledAt,
                shared: false,
                sharedAt: Math.max(Date.now(), (joined.sharedAt ?? 0) + 1)
            }
        });
    }
    async _mintMesh(opts) {
        const { shared, workspace, seed } = opts;
        if (this.closing) {
            throw new CoreError('CORE_CLOSING', ['Core']);
        }
        if (this._blockedByMinVersion()) {
            throw new CoreError('MESH_BELOW_FLOOR');
        }
        if (this._leaving || this._minting) {
            throw new CoreError('MESH_TRANSITION_IN_PROGRESS');
        }
        const registry = opts.registry ?? (await this._writableAccount());
        if (shared && !registry) {
            throw new CoreError('ACCOUNT_MESH_MISSING');
        }
        if (registry && !registry.ourMemberId) {
            throw new CoreError('ACCOUNT_MEMBER_UNKNOWN');
        }
        const role = workspace ? 'workspace' : undefined;
        const mesh = await this._openMesh({ new: true, sharing: true, role, workspace, seed });
        this._wireMesh(this._poolEntry(mesh));
        this._bringMeshOnline(mesh, { new: true });
        try {
            await mesh.refreshOurMember();
            if (!mesh.ourMemberId) {
                throw new CoreError('MESH_WITHOUT_MEMBER');
            }
            if (registry) {
                await this._registerMesh(mesh.key, { shared, workspace: !!workspace, registry });
            }
        }
        catch (error) {
            await this._discardMesh(mesh);
            throw error;
        }
        this._notifyStatus();
        return this._meshIdOf(mesh);
    }
    async _discardMesh(mesh) {
        try {
            await this._teardownMesh(mesh);
        }
        catch (error) {
            this._log?.error(['p2p', 'mesh'], 'an unregistered mesh was left behind', error);
        }
    }
    async openMesh(meshId) {
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            await this._openPooledMesh(meshId);
        }
        finally {
            this._meshTransitionLock.unlock();
        }
    }
    async closeMesh(meshId) {
        if (!this.opened)
            await this.ready();
        await this._meshTransitionLock.lock();
        try {
            if (meshId === this._accountId) {
                throw new CoreError('ACCOUNT_MESH_CLOSE_REFUSED');
            }
            const key = this._meshKeyOf(meshId);
            const mesh = this._pooled(meshId) ?? (await this._opening.get(meshId)?.catch(noop)) ?? null;
            if (!mesh || this._isForeign(mesh)) {
                if (!(await this.local.readMeshSession(key))) {
                    throw new CoreError('MESH_NOT_FOUND', [meshId]);
                }
                return;
            }
            await this._retirePooledMesh(mesh);
        }
        finally {
            this._meshTransitionLock.unlock();
        }
        this._notifyStatus();
    }
    async _openPooledMesh(meshId, reason = 'route') {
        if (!this.opened)
            await this.ready();
        if (this.closing) {
            throw new CoreError('CORE_CLOSING', ['Core']);
        }
        if (this._blockedByMinVersion()) {
            throw new CoreError('MESH_BELOW_FLOOR');
        }
        const pooled = this._pooled(meshId);
        if (pooled && this._isForeign(pooled)) {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        if (pooled) {
            return pooled;
        }
        const retiring = this._retiring.get(meshId);
        if (retiring) {
            await retiring.catch(noop);
            return this._openPooledMesh(meshId);
        }
        const inflight = this._opening.get(meshId);
        if (inflight) {
            return inflight;
        }
        const opening = this._openRecordedMesh(meshId, reason).finally(() => {
            if (this._opening.get(meshId) === opening) {
                this._opening.delete(meshId);
            }
        });
        this._opening.set(meshId, opening);
        return opening;
    }
    async _openRecordedMesh(meshId, reason) {
        if (this._debugBeforeMeshOpen) {
            await this._debugBeforeMeshOpen(meshId);
        }
        const started = Date.now();
        const key = this._meshKeyOf(meshId);
        const session = await this.local.readMeshSession(key);
        if (!session) {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        const stored = await this._storedAccountKey();
        const sharing = !stored || !b4a.equals(stored, key);
        const mesh = await this._openMeshSession(session, { sharing, account: !sharing });
        const halted = mesh.interrupted;
        if (halted) {
            this._withdrawFromMesh(mesh, halted);
            throw halted;
        }
        this._wireMesh(this._poolEntry(mesh));
        if (this._isAccount(mesh)) {
            void this._deviceControl.revalidate();
            void this._followPublicMesh(mesh);
        }
        if (this._isAccount(mesh) && this._statusError?.startsWith(MESH_DIED)) {
            this._statusError = null;
        }
        this._bringMeshOnline(mesh, { announce: !session.workspaceKey });
        if (mesh.writable) {
            void this.local.markAwaitingAdmission(mesh.key, { awaitingAdmission: false }).catch(noop);
        }
        this._notifyStatus();
        this._debugOnMeshOpened?.(mesh, meshId);
        this._log?.info(['p2p', 'mesh'], 'mesh opened', {
            mesh: meshId.slice(0, 8),
            reason,
            account: this._isAccount(mesh),
            writable: mesh.writable,
            localLength: mesh.localLength,
            ms: Date.now() - started
        });
        return mesh;
    }
    async _meshEntry(row, accountKey, meshes) {
        const meshId = b4a.toHex(row.key);
        const mesh = this._pooled(meshId);
        const account = !!accountKey && b4a.equals(accountKey, row.key);
        const joined = meshes.get(meshId);
        const state = this._meshEntryState(mesh, account);
        return {
            meshId,
            state,
            writable: mesh?.writable ?? false,
            open: mesh !== null,
            account,
            label: joined?.label || undefined,
            name: mesh?.name?.name || undefined,
            members: mesh?.membership.members ?? 0,
            shared: joined?.shared ?? false,
            sharedAt: joined?.shared ? joined.sharedAt : undefined,
            workspace: row.role === 'workspace'
        };
    }
    _meshEntryState(mesh, account) {
        if (account) {
            return this._statusState();
        }
        if (!mesh)
            return 'idle';
        return mesh.writable ? 'joined' : 'joining';
    }
    _meshKeyOf(meshId) {
        if (!MESH_ID.test(meshId)) {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        return b4a.from(meshId, 'hex');
    }
    async removeDeviceWriter(writerKey, deviceId, mesh) {
        const target = mesh ?? (await this._awaitMesh());
        if (!target) {
            throw new Error('this device holds no account mesh');
        }
        const paired = await this._accountMesh()?.view.get(DEVICES, { id: deviceId });
        const row = await target.view.get(DEVICES, { id: deviceId });
        const revokedAt = Math.max(Date.now(), (paired?.joinedAt ?? 0) + 1);
        await target.dispatch('remove-writer', { writerKey, deviceId, revokedAt });
        await target.autobee.update();
        const self = this._requireDeviceKeyPair().publicKey;
        const ours = target === this._accountMesh() || ownedBy(row, target.ourMemberId);
        if (row &&
            ours &&
            !b4a.equals(deviceId, self) &&
            !this._isOwnPublic(target) &&
            target.writable) {
            await rehomeAgents(target, deviceId, self).catch((err) => this._log?.warn(['p2p', 'mesh'], "handing over a removed device's agents failed", err));
        }
        if (target === this._accountMesh()) {
            this._sweepUnknownEverywhere = true;
        }
        await this._revokeInMeshes();
    }
    _revokeInMeshes() {
        if (this._revokingInMeshes) {
            this._revokeInMeshesAgain = true;
            return this._revokingInMeshes;
        }
        this._revokingInMeshes = (async () => {
            do {
                this._revokeInMeshesAgain = false;
                await this._revokeInMeshesOnce();
            } while (this._revokeInMeshesAgain);
        })().finally(() => {
            this._revokingInMeshes = null;
        });
        return this._revokingInMeshes;
    }
    async _sweepEveryOwnMesh(account, ours) {
        for await (const joined of account.view.find(JOINED_MESHES)) {
            if (b4a.equals(joined.memberId, ours) && !joined.leftAt) {
                this._sweepUnknownIn.add(b4a.toHex(joined.meshKey));
            }
        }
    }
    async _revokeStaleRows(account, mesh, { self, ours, unknownToo }) {
        const rows = [];
        for await (const row of mesh.view.find(DEVICES)) {
            rows.push(row);
        }
        for (const row of rows) {
            if (!row.writerKey || row.revoked || b4a.equals(row.id, self)) {
                continue;
            }
            const member = row.memberId ?? row.claimedMemberId;
            if (member && !b4a.equals(member, ours)) {
                continue;
            }
            const device = await account.view.get(DEVICES, { id: row.id });
            if (device && !device.revoked) {
                continue;
            }
            if (!member &&
                device?.writerKey &&
                device.revokedBy &&
                b4a.equals(device.revokedBy, device.writerKey)) {
                continue;
            }
            if (!device && (!member || !unknownToo)) {
                continue;
            }
            await mesh.dispatch('remove-writer', {
                writerKey: row.writerKey,
                deviceId: row.id,
                revokedAt: device ? device.revokedAt : Date.now()
            });
        }
    }
    async _rehomeRemoved(account, mesh, self) {
        if (!mesh.writable || this._isOwnPublic(mesh) || !inRole(mesh.role, '@qvac/put-agent')) {
            return;
        }
        const removed = [];
        const live = [];
        for await (const row of mesh.view.find(DEVICES)) {
            const ours = mesh === account || ownedBy(row, mesh.ourMemberId);
            if (row.revoked && ours && !b4a.equals(row.id, self)) {
                removed.push(row.id);
            }
            else if (!row.revoked && ours) {
                live.push(row);
            }
        }
        const adopter = await earliestPaired(account, live);
        const adopts = adopter !== undefined && b4a.equals(adopter.id, self);
        for (const id of removed) {
            const device = await account.view.get(DEVICES, { id });
            const by = device?.revokedBy;
            const left = device?.revoked && device.writerKey && by && b4a.equals(by, device.writerKey);
            if ((by && b4a.equals(by, account.localWriterKey)) || (left && adopts)) {
                await rehomeAgents(mesh, id, self).catch((err) => this._log?.warn(['p2p', 'mesh'], "handing over a removed device's agents failed", err));
            }
        }
    }
    async _revokeInMeshesOnce() {
        try {
            const account = this._accountMesh();
            if (!account?.ourMemberId) {
                return;
            }
            if (this._sweepUnknownEverywhere) {
                this._sweepUnknownEverywhere = false;
                await this._sweepEveryOwnMesh(account, account.ourMemberId);
            }
            const self = this._requireDeviceKeyPair().publicKey;
            await this._rehomeRemoved(account, account, self);
            for (const { mesh } of [...this._meshes.values()]) {
                if (mesh === account || !mesh.writable)
                    continue;
                if (!this._isOwnPublic(mesh) && !(await this._isOwnMeshIn(account, mesh.key))) {
                    continue;
                }
                if (!mesh.ourMemberId) {
                    await mesh.refreshOurMember();
                }
                if (!mesh.ourMemberId) {
                    continue;
                }
                const meshId = b4a.toHex(mesh.key);
                const unknownToo = this._sweepUnknownIn.has(meshId);
                await this._revokeStaleRows(account, mesh, { self, ours: mesh.ourMemberId, unknownToo });
                await this._rehomeRemoved(account, mesh, self);
                this._sweepUnknownIn.delete(meshId);
            }
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'revoking an account-revoked device in a shared mesh failed', error);
        }
    }
    async renameLocalDevice(name) {
        const publicKey = this.devicePublicKey;
        if (publicKey) {
            await this.local.renameDevice(publicKey, name);
        }
        if (this._localDevice) {
            this._localDevice = { ...this._localDevice, name };
        }
    }
    async account() {
        if (!this.opened)
            await this.ready();
        const key = await this._storedAccountKey();
        return {
            meshId: key ? b4a.toHex(key) : undefined,
            writable: this._accountWritable(),
            displayName: (await this.displayName()) ?? undefined,
            ownWorkspace: this._ownWorkspaceId ?? undefined
        };
    }
    async displayName() {
        const identity = await this.local.readIdentity();
        if (!identity) {
            return null;
        }
        return identity.displayName ?? (await this._accountMemberName(identity.publicKey));
    }
    async _accountMemberName(identityPublicKey) {
        const key = await this._storedAccountKey();
        const mesh = key ? this._pooled(b4a.toHex(key)) : null;
        if (!mesh) {
            return null;
        }
        const ours = mesh.ourMemberId;
        if (!ours || b4a.equals(ours, identityPublicKey)) {
            return null;
        }
        const member = await mesh.view.get(MEMBERS, { id: ours });
        return member?.name ?? null;
    }
    async saveDeviceProfileLocal(capabilityProfile, recommendedModelName, platform) {
        const publicKey = this.devicePublicKey;
        if (publicKey) {
            await this.local.saveDeviceProfile(publicKey, {
                capabilityProfile,
                recommendedModelName,
                platform
            });
        }
        if (this._localDevice) {
            this._localDevice = {
                ...this._localDevice,
                capabilityProfile,
                recommendedModelName,
                platform: platform ?? this._localDevice.platform
            };
        }
    }
    async waitForWritable() {
        if (this.closing)
            return;
        if (!this.opened)
            await this.ready();
        const mesh = await this._awaitMesh();
        if (this.closing || !mesh) {
            return;
        }
        await Promise.race([mesh.waitForWritable(), this._closeSignal]);
    }
    async _assertMeshIsHere(meshId) {
        const meshKey = this._meshKeyOf(meshId);
        if (await this.local.readMeshSession(meshKey)) {
            return;
        }
        const registry = await this._writableAccount();
        if (registry && (await this._isOwnMeshIn(registry, meshKey))) {
            throw new CoreError('MESH_HELD_BY_SIBLING');
        }
    }
    async getMeshInvite(opts = {}) {
        if (opts.memberInvite && opts.meshId) {
            await this._assertMeshIsHere(opts.meshId);
        }
        if (this.closing) {
            return null;
        }
        if (!this.opened) {
            await this.ready();
        }
        const accountKey = opts.memberInvite ? null : await this._storedAccountKey();
        const target = opts.meshId ?? (accountKey ? b4a.toHex(accountKey) : null);
        const mesh = target ? await this._openPooledMesh(target) : await this._awaitMesh();
        if (!mesh) {
            return null;
        }
        const registry = await this._writableAccount();
        if (!registry?.ourMemberId) {
            throw new CoreError('INVITE_ACCOUNT_UNREADABLE');
        }
        if (opts.memberInvite && (await meshKind(mesh.view)) === 'project') {
            throw new CoreError('PROJECT_MEMBER_INVITE_REFUSED');
        }
        const isOwnMesh = await this._isOwnMeshIn(registry, mesh.key);
        const workspace = mesh.role === 'workspace';
        if (opts.memberInvite) {
            if (!isOwnMesh) {
                throw new CoreError('MEMBER_INVITE_ACCOUNT_REFUSED');
            }
            if (isOwnWorkspace(registry, mesh)) {
                throw new CoreError('OWN_WORKSPACE_INVITE_REFUSED');
            }
            if (workspace) {
                await requireOurAdmin(mesh, 'invite a member');
            }
        }
        else {
            if (isOwnMesh) {
                throw new CoreError('DEVICE_INVITE_MESH_REFUSED');
            }
            const key = await this._storedAccountKey();
            if (!key) {
                throw new CoreError('INVITE_ACCOUNT_UNREADABLE');
            }
            if (!b4a.equals(key, mesh.key)) {
                throw new CoreError('DEVICE_INVITE_MESH_REFUSED');
            }
        }
        const auto = mesh.autobee;
        const info = await auto.system.getInfo();
        const head = info && info.view.length > 0 ? await auto.trusted.mostRecentTrusted(auto.view, null) : null;
        const additionalNodes = this._swarm
            ? this._swarm.dht.toArray({ limit: INVITE_DHT_NODES_LIMIT })
            : [];
        const memberId = opts.memberInvite ? undefined : (mesh.ourMemberId ?? undefined);
        const delegation = memberId ? await this._delegatePairing(mesh) : null;
        const inviterName = memberId
            ? ((await mesh.view.get(MEMBERS, { id: memberId }))?.name ?? undefined)
            : undefined;
        const snap = mesh.view.snapshot();
        let blindPeerRows;
        try {
            blindPeerRows = await snap
                .find(MESH_BLIND_PEERS, { limit: INVITE_BLIND_PEERS_LIMIT })
                .toArray();
        }
        finally {
            await snap.close();
        }
        return {
            baseKey: mesh.key,
            seed: mesh.seed,
            fastForward: head ? { key: head.key, length: head.length } : null,
            additionalNodes,
            blindPeers: blindPeerRows.length
                ? blindPeerRows.map((row) => row.key)
                : this._resolveBlindPeerKeys().slice(0, INVITE_BLIND_PEERS_LIMIT),
            memberInvite: opts.memberInvite ?? false,
            memberId,
            inviterName,
            deviceSeed: delegation?.deviceSeed,
            deviceProof: delegation?.deviceProof,
            workspace,
            workspaceName: opts.memberInvite ? mesh.name?.name || undefined : undefined
        };
    }
    async _delegatePairing(account) {
        const keyPair = this._requireDeviceKeyPair();
        const own = await account.view.get(DEVICES, { id: keyPair.publicKey });
        if (!own?.memberId || !own.memberProof) {
            throw new CoreError('DEVICE_INVITE_UNLINKED');
        }
        const deviceSeed = pairingAnchorSeed(account.seed, own.memberId);
        const anchor = crypto.keyPair(deviceSeed);
        const deviceProof = await this._shortestAnchorProof(account, {
            anchor,
            memberId: own.memberId,
            memberProof: own.memberProof
        });
        if (!(await delegationFits(deviceProof, anchor))) {
            throw new CoreError('DEVICE_INVITE_CHAIN_TOO_LONG');
        }
        return { deviceSeed, deviceProof };
    }
    async _shortestAnchorProof(account, { anchor, memberId, memberProof }) {
        const keyPair = this._requireDeviceKeyPair();
        let shortest = await attestDeviceProof(anchor.publicKey, keyPair, memberProof);
        for await (const row of account.view.find(DEVICES)) {
            if (row.revoked || !row.memberId || !row.memberProof)
                continue;
            if (!b4a.equals(row.memberId, memberId))
                continue;
            const cut = chainTo(row.memberProof, anchor.publicKey);
            if (cut && cut.byteLength < shortest.byteLength) {
                shortest = cut;
            }
        }
        return shortest;
    }
    previewMeshInvite(invite) {
        const decoded = decodeMeshInvite(invite);
        if (!decoded) {
            throw new CoreError('INVITE_INVALID');
        }
        return {
            memberInvite: decoded.memberInvite ?? false,
            inviterName: decoded.inviterName,
            workspaceName: decoded.workspaceName
        };
    }
    async _closeSwarm() {
        if (this._ownsWakeup) {
            this._wakeup.destroy();
        }
        this._deviceControl.destroy();
        if (!this._swarm) {
            return;
        }
        const swarm = this._swarm;
        this._swarm = null;
        swarm.off('connection', this._onSwarmConnection);
        if (!this._ownsSwarm) {
            for (const detach of this._peers.values()) {
                detach();
            }
            this._peers.clear();
            await Promise.all([...this._meshes.values()].map(({ mesh }) => swarm.leave(mesh.discoveryKey)));
            return;
        }
        for (const conn of swarm.connections) {
            conn.destroy?.();
        }
        await swarm.destroy();
    }
    async pushSkillSecret(request) {
        if (!this.opened)
            await this.ready();
        await storeSkillSecret({
            local: this.local,
            setupFields: (skillName) => this._setupFields(skillName),
            onstored: () => this._skillCatalog?.(null, null, { refresh: true }) ?? Promise.resolve()
        }, request);
        await this._followSkillSecrets();
    }
    async _followSkillSecrets() {
        if (!(await this._skillSecrets.lock()))
            return;
        try {
            const account = this._accountMesh();
            const live = account && !account.closing && !this.closing;
            if (live && (await syncSkillSecrets({ account, local: this.local }))) {
                await this._skillCatalog?.(null, null, { refresh: true });
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'syncing skill secrets failed', err);
            }
        }
        finally {
            this._skillSecrets.unlock();
        }
    }
    async _followJoinedMeshes(memberMesh) {
        if (this.closing || !this._isPooled(memberMesh))
            return;
        const entry = this._meshes.get(this._meshIdOf(memberMesh));
        if (entry?.mesh !== memberMesh) {
            return;
        }
        if (!memberMesh.joined) {
            entry.meshesPending = true;
            return;
        }
        if (!memberMesh.ourMemberId) {
            await memberMesh.refreshOurMember();
        }
        const ours = memberMesh.ourMemberId;
        if (!ours) {
            entry.meshesPending = false;
            return;
        }
        if (!(await entry.followLock.lock())) {
            return;
        }
        const tally = {
            rows: 0,
            opened: 0,
            readmitted: 0,
            held: 0,
            left: 0,
            noSeed: 0,
            skipped: 0
        };
        try {
            entry.meshesPending = await this._followMeshRows(memberMesh, ours, tally);
        }
        finally {
            entry.followLock.unlock();
        }
        const level = tally.opened || tally.readmitted || tally.left ? 'info' : 'debug';
        this._log?.[level](['p2p', 'mesh'], 'followed the joined meshes', {
            mesh: b4a.toHex(memberMesh.key).slice(0, 8),
            ...tally,
            pending: entry.meshesPending
        });
    }
    async _followMeshRows(memberMesh, ours, tally) {
        let pending = false;
        for await (const joined of memberMesh.view.find(JOINED_MESHES)) {
            if (this.closing ||
                this._minting ||
                !this._isPooled(memberMesh) ||
                this._leaving === this._meshIdOf(memberMesh)) {
                return pending;
            }
            if (!b4a.equals(joined.memberId, ours))
                continue;
            const meshId = b4a.toHex(joined.meshKey);
            tally.rows++;
            if (this._following.has(meshId)) {
                continue;
            }
            const held = this._pooled(meshId);
            const failed = await this._trackFollow(meshId, async () => {
                if (await lostMint(memberMesh, joined.meshKey)) {
                    return;
                }
                if (joined.leftAt) {
                    if (held) {
                        tally.left++;
                        await this._retireLeftMesh(held);
                    }
                    else {
                        await this._archiveLeftMeshRow(joined.meshKey);
                    }
                    return;
                }
                if (held) {
                    tally.held++;
                    return;
                }
                if (await this.local.readMeshSession(joined.meshKey)) {
                    if (this._upgradeRequired !== 'halt' &&
                        (await this.local.awaitsAdmission(joined.meshKey))) {
                        tally.readmitted++;
                        await this._openPooledMesh(meshId, 'readmit');
                    }
                    return;
                }
                const outcome = await this._openFollowedMesh(memberMesh, joined);
                if (outcome === 'opened') {
                    tally.opened++;
                }
                else if (outcome === 'no-seed') {
                    tally.noSeed++;
                }
                else {
                    tally.skipped++;
                }
            });
            if (failed && !joined.leftAt) {
                pending = true;
            }
        }
        return pending;
    }
    async _trackFollow(meshId, work) {
        let failed = false;
        const pass = work().catch((error) => {
            failed = true;
            this._log?.warn(['p2p', 'mesh'], 'following a joined mesh failed', error);
        });
        this._following.set(meshId, pass);
        try {
            await pass;
        }
        finally {
            if (this._following.get(meshId) === pass) {
                this._following.delete(meshId);
            }
        }
        return failed;
    }
    async _retireLeftMesh(mesh) {
        if (this._leaving || this._minting)
            return;
        try {
            this._log?.info(['p2p', 'mesh'], 'retiring a mesh the member left', {
                mesh: b4a.toHex(mesh.key).slice(0, 8),
                account: this._isAccount(mesh)
            });
            await this._recordDeparture(mesh);
            if (this._isAccount(mesh)) {
                await this._replaceRevokedAccount(mesh);
            }
            else {
                await this._departRevokedMesh(mesh);
            }
            this._departures?.flush();
        }
        catch (error) {
            this._log?.warn(['p2p', 'mesh'], 'retiring a mesh the member left failed', error);
        }
    }
    async _archiveLeftMeshRow(meshKey) {
        if (await this.local.readMeshSession(meshKey)) {
            await this._teardownMesh(meshKey);
        }
    }
    async _openFollowedMesh(memberMesh, joined) {
        if (this._blockedByMinVersion() || this._upgradeRequired || !this._mayFollow(memberMesh)) {
            return 'skipped';
        }
        const { meshKey } = joined;
        const held = await memberMesh.view.get(MESH_SEEDS, { meshKey });
        if (!held) {
            return 'no-seed';
        }
        if (this.closing) {
            return 'skipped';
        }
        const role = joined.workspace ? 'workspace' : undefined;
        const session = this.local.createCandidateSession(held.seed, meshKey, { role });
        await this.local.recordMesh(meshKey, session, {
            deviceId: this._requireDeviceKeyPair().publicKey
        });
        await this.local.markAwaitingAdmission(meshKey, { awaitingAdmission: true });
        await this._openPooledMesh(b4a.toHex(meshKey), 'follow');
        return 'opened';
    }
    async _followProjects(workspace) {
        const leaving = this._leaving === this._meshIdOf(workspace);
        if (this.closing || leaving || this._upgradeRequired || this._blockedByMinVersion()) {
            return;
        }
        if (!workspace.ourMemberId) {
            await workspace.refreshOurMember();
        }
        const ours = workspace.ourMemberId;
        if (!ours) {
            return;
        }
        for await (const project of workspace.view.find(PROJECTS)) {
            if (this.closing || !this._isPooled(workspace)) {
                return;
            }
            const meshId = b4a.toHex(project.id);
            if (project.deletedAt) {
                this._kickedProjects.delete(meshId);
                if (!this._following.has(meshId)) {
                    await this._trackFollow(meshId, () => this._dropDeletedProject(workspace, project.id));
                }
                continue;
            }
            if (!listsMember(project, ours)) {
                if (this._kickedProjects.has(meshId)) {
                    this._kickedProjects.set(meshId, null);
                }
                if (!this._following.has(meshId)) {
                    await this._trackFollow(meshId, () => this._purgeLeftProject(workspace, project));
                }
                continue;
            }
            const held = this._pooled(meshId);
            if (held && this._isForeign(held)) {
                await this._releaseHostMesh(meshId, { replaced: true });
            }
            const kicked = this._kickedProjects.get(meshId) === workspace;
            if (kicked || this._following.has(meshId) || this._pooled(meshId)) {
                continue;
            }
            await this._trackFollow(meshId, () => this._openListedProject(workspace, project));
        }
        void this._sealProjectKeys();
    }
    async _sealProjectKeys() {
        if (!(await this._projectKeySeals.lock()))
            return;
        try {
            for (const { mesh } of [...this._meshes.values()]) {
                if (this.closing)
                    return;
                if (mesh.role === 'workspace' && mesh.writable && !mesh.closing) {
                    await this._sealWorkspaceProjectKeys(mesh);
                }
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(['p2p', 'mesh'], 'sealing project seeds failed', err);
            }
        }
        finally {
            this._projectKeySeals.unlock();
        }
    }
    async _sealWorkspaceProjectKeys(workspace) {
        const ours = workspace.ourMemberId;
        if (!ours) {
            return;
        }
        const rows = await workspace.view.find(PROJECTS).toArray();
        for (const row of rows.filter((listed) => listedProject(listed, ours))) {
            const seed = await this._heldProjectSeed(workspace, row.id);
            if (seed) {
                await this._sealListedMembers(workspace, row, seed);
                await this._sealProjectHosts(workspace, row.id, seed);
            }
        }
    }
    async _sealListedMembers(workspace, row, seed) {
        const batch = workspace.batch();
        for (const memberId of row.memberIds ?? []) {
            const due = await dueProjectKey(workspace.view, memberId, { projectId: row.id, seed });
            if (due) {
                batch.dispatch('put-project-key', due);
            }
        }
        for (const due of await dueProjectDeviceKeys(workspace.view, row, seed)) {
            batch.dispatch('put-project-device-key', due);
        }
        await batch.flush();
    }
    async _sealProjectHosts(workspace, projectId, seed) {
        const project = this._pooled(b4a.toHex(projectId));
        if (!project || this._isForeign(project)) {
            return;
        }
        const batch = workspace.batch();
        for (const user of await workspace.view.find(AGENT_USERS).toArray()) {
            const agent = b4a.equals(user.userId, projectId) && (await liveSharedAgent(workspace, user.agentId));
            const sealing = { projectId, seed, project: project.view };
            const due = agent && (await dueProjectHostKey(workspace.view, agent, sealing));
            if (due) {
                batch.dispatch('put-project-host-key', due);
            }
        }
        await batch.flush();
    }
    async _heldProjectSeed(workspace, id) {
        if (!(await this._isProjectOf(workspace.key, id)) || (await this.local.awaitsAdmission(id))) {
            return null;
        }
        return (await this.local.readMeshSession(id))?.seed ?? null;
    }
    async _ownProjectSeed(workspace, projectId) {
        const sealedToMember = await this._memberProjectSeed(workspace, projectId);
        return sealedToMember ?? (await this._deviceProjectSeed(workspace, projectId));
    }
    async _memberProjectSeed(workspace, projectId) {
        const ours = workspace.ourMemberId;
        const account = this._accountMesh();
        if (!ours || !account) {
            return null;
        }
        const row = await readProjectKey(workspace.view, projectId, ours);
        const pair = memberBoxKeyPair(account.seed);
        return row && b4a.equals(row.boxKey, pair.publicKey)
            ? openSealedToMember(row.sealedSeed, pair)
            : null;
    }
    async _deviceProjectSeed(workspace, projectId) {
        const device = this._requireDeviceKeyPair();
        const row = await readProjectDeviceKey(workspace.view, projectId, device.publicKey);
        return row && openSealedToDevice(row.sealedSeed, device);
    }
    async _projectGone(projectId) {
        return !(await this.local.readMeshSession(b4a.from(projectId, 'hex')));
    }
    async _isProjectOf(workspaceKey, key) {
        const record = await this.local.meshRecord(key);
        const of = record?.role === 'project' ? record.workspaceKey : null;
        return !!of && b4a.equals(of, workspaceKey);
    }
    async _dropDeletedProject(workspace, key) {
        if (await this.local.readPurge(key)) {
            await this._finishPurge(key);
        }
        else if (await this._isProjectOf(workspace.key, key)) {
            await this._purgeProject(key);
        }
    }
    async _purgeLeftProject(workspace, project) {
        if ((await this.local.readMeshSession(project.id)) &&
            (await this._isProjectOf(workspace.key, project.id))) {
            await this._heldMesh(project.id);
        }
    }
    async _purgeProject(key) {
        const held = await this._heldMesh(key);
        if (held) {
            await this._teardownMesh(held, { purge: true });
        }
    }
    async _finishHeldPurge(key) {
        try {
            if (await this.local.readPurge(key)) {
                await this._finishPurge(key);
            }
        }
        catch (err) {
            this._log?.warn(['p2p', 'mesh'], 'finishing a purge after its departure failed', err);
        }
    }
    _finishPurge(key) {
        const meshId = b4a.toHex(key);
        const running = this._purging.get(meshId);
        if (running) {
            return running;
        }
        const purge = this._purgeAndDrop(key).finally(() => this._purging.delete(meshId));
        this._purging.set(meshId, purge);
        return purge;
    }
    async _purgeAndDrop(key) {
        if (await this._departing(key)) {
            return;
        }
        const pending = await this.local.readPurge(key);
        if (pending) {
            await purgeCores(this.store, this.storage, pending.cores ?? []);
        }
        if (await this.local.dropMesh(key)) {
            this._log?.info(['p2p', 'mesh'], 'dropped a project and its cores', {
                mesh: b4a.toHex(key).slice(0, 8)
            });
            this._notifyStatus();
        }
    }
    async _departing(key) {
        const departures = await this.local.departures();
        return departures.some((row) => b4a.equals(row.key, key));
    }
    async _resumePurges() {
        for (const { key } of await this.local.pendingPurges()) {
            await this._finishPurge(key).catch((err) => this._log?.warn(['p2p', 'mesh'], 'finishing an interrupted purge failed', {
                mesh: b4a.toHex(key).slice(0, 8),
                err
            }));
        }
    }
    async _openListedProject(workspace, { id }) {
        const meshId = b4a.toHex(id);
        await this._purging.get(meshId);
        if ((await this.local.readPurge(id)) && !(await this._departing(id))) {
            return;
        }
        const record = await this.local.meshRecord(id);
        if (record && !(await this._isProjectOf(workspace.key, id))) {
            return;
        }
        if (record && !record.leftAt) {
            if (await this.local.awaitsAdmission(id)) {
                await this._openPooledMesh(meshId, 'readmit');
            }
            return;
        }
        const seed = await this._ownProjectSeed(workspace, id);
        if (!seed) {
            return;
        }
        const session = this.local.createCandidateSession(seed, id, {
            role: 'project',
            workspaceKey: workspace.key
        });
        await this.local.recordMesh(id, session, { deviceId: this._requireDeviceKeyPair().publicKey });
        await this.local.markAwaitingAdmission(id, { awaitingAdmission: true });
        await this._openPooledMesh(meshId, 'follow');
    }
    _mayFollow(memberMesh) {
        const moving = this._joinCancellation ? this._joinCancellation.account : this._minting;
        const leaving = this._leaving === this._meshIdOf(memberMesh);
        return !this.closing && !moving && !leaving && this._isAccount(memberMesh);
    }
    async _isOwnLiveDevice(deviceId) {
        const account = this._accountMesh();
        const ours = account?.ourMemberId;
        if (!account || !ours) {
            return false;
        }
        const device = await account.view.get(DEVICES, { id: deviceId });
        return !!device?.memberId && !device.revoked && b4a.equals(device.memberId, ours);
    }
    async _listInferenceCalls(meshId, chatId) {
        await requireMesh(this._meshPool(), meshId, { route: 'put-chat' });
        if (!this._inferenceCalls) {
            throw new CoreError('INFERENCE_RECORDING_OFF');
        }
        return this._inferenceCalls.list(chatId);
    }
    async _runLocalSkillOverlayOp(op) {
        const mgmt = this._skillManagement;
        switch (op.op) {
            case 'list':
                return { skills: ((await mgmt?.listManagedSkills()) ?? { skills: [] }).skills };
            case 'read': {
                const res = (await mgmt?.readSkillFile(op.name ?? '')) ?? { found: false };
                return { found: res.found ?? false, content: res.content, origin: res.origin };
            }
            case 'write': {
                const { ok } = (await mgmt?.writeSkillFile(op.name ?? '', op.content ?? '')) ?? {
                    ok: false
                };
                if (ok) {
                    await this._forgetSkillBodies();
                }
                return { ok };
            }
            case 'copy':
                return {
                    copied: ((await mgmt?.copySkillForEdit(op.name ?? '')) ?? { copied: false }).copied
                };
            case 'delete': {
                const { removed } = (await mgmt?.deleteOverlaySkill(op.name ?? '')) ?? { removed: false };
                if (removed) {
                    await this._forgetSkillBodies();
                }
                return { removed };
            }
            default:
                throw new CoreError('SKILL_OVERLAY_OP_UNKNOWN', [op.op]);
        }
    }
    async _forgetSkillBodies() {
        const result = await this._clearKvCache?.();
        if (result?.status === 'failure') {
            this._log?.warn('skills', 'kv caches not cleared after a skill edit', { error: result.error });
        }
    }
    async _setupFields(skillName) {
        const skills = await this._hostSkills();
        if (skills.length === 0) {
            return null;
        }
        const skill = skills.find((entry) => entry.name === skillName);
        if (!skill) {
            return new Map();
        }
        const fields = new Map();
        for (const slot of skill.credentials ?? []) {
            for (const key of slot.split('|')) {
                fields.set(key, true);
            }
        }
        const foreign = credentialKeysOwnedElsewhere(skills, skillName);
        for (const route of skill.setup?.routes ?? []) {
            if (route.credentialKey) {
                fields.set(route.credentialKey, true);
            }
            const stateKey = route.oauth?.stateKey;
            if (stateKey && !foreign.has(stateKey)) {
                fields.set(stateKey, true);
            }
            for (const field of route.fields ?? []) {
                fields.set(field.key, field.secret === true);
            }
        }
        return fields;
    }
    async _hostSkills() {
        await this._waitForCatalogHooks();
        const catalog = await this._skillCatalog?.(null, null, { skipCredentialProbe: true });
        return catalog?.skills ?? [];
    }
    _onConnection(conn) {
        if (this.closing) {
            conn.on('error', noop);
            return;
        }
        const remoteId = b4a.toHex(conn.remotePublicKey).slice(0, 8);
        const start = Date.now();
        let bytes = 0;
        let connErr = null;
        this._log?.info(['p2p', 'peer'], `got ${conn.isInitiator ? 'client' : 'server'} connection to ${remoteId}`);
        const onerror = (err) => {
            connErr = err;
        };
        const onclose = () => {
            this._log?.info(['p2p', 'peer'], `connection closed to ${remoteId}, with err: ${connErr} (${Date.now() - start} ms ${bytes} bytes recv)`);
        };
        const ondata = (data) => {
            bytes += data.byteLength;
        };
        conn.once('error', onerror);
        conn.once('close', onclose);
        conn.on('data', ondata);
        this._trackPeerConnection(conn, () => {
            conn.off('error', onerror);
            conn.off('close', onclose);
            conn.off('data', ondata);
        });
        this._deviceControl.addStream(conn);
        if (this._ownsSwarm) {
            this._wakeup.addStream(conn);
            this.rootCorestore.replicate(conn);
        }
        if (this.suspended) {
            this._peerArrivedSuspended = true;
        }
    }
    _onMeshPeer(mesh) {
        const entry = this._meshes.get(this._meshIdOf(mesh));
        if (this.closing || entry?.mesh !== mesh) {
            return;
        }
        if (this.suspended) {
            this._peerArrivedSuspended = true;
            return;
        }
        this._retryOnPeer(entry);
    }
    _retryOnPeer(entry) {
        void this._followJoinedMeshes(entry.mesh);
        entry.mesh.files.reconnect();
    }
    _trackPeerConnection(conn, detach) {
        const remove = () => {
            if (this._peers.delete(conn)) {
                this._onPeerChange();
                for (const entry of this._meshes.values()) {
                    entry.processingFiles?.rescan();
                }
            }
        };
        this._peers.set(conn, () => {
            detach();
            conn.off('close', remove);
            conn.off('error', remove);
        });
        this._onPeerChange();
        conn.once('close', remove);
        conn.once('error', remove);
    }
    _onPeerChange() {
        this._log?.info(['p2p', 'peer'], 'peer connections changed', {
            connections: this._peers.size,
            peers: this.peerDeviceIds.length
        });
        this._notifyStatus();
    }
    _meshPool() {
        return (meshId, request = {}) => {
            const pooled = this._pooled(meshId);
            if (pooled && this._isForeign(pooled)) {
                return null;
            }
            if (pooled && this._definesAgents(pooled, request)) {
                return this._accountMesh() ?? pooled;
            }
            if (pooled && !this._routesToPublic(pooled, request)) {
                return pooled;
            }
            return this._routedMesh(pooled, meshId, request);
        };
    }
    _servedPool() {
        const strict = this._meshPool();
        return async (meshId, request = {}) => {
            const pooled = this._pooled(meshId);
            if (!pooled || !this._isForeign(pooled)) {
                return strict(meshId, request);
            }
            const deviceId = this._requireDeviceKeyPair().publicKey;
            if (request.chatId) {
                return (await servesChat(pooled, deviceId, request.chatId)) ? pooled : null;
            }
            if (request.chunkId) {
                return (await servesChunk(pooled, deviceId, request.chunkId)) ? pooled : null;
            }
            return request.wide && (await servesAgents(pooled, deviceId)) ? pooled : null;
        };
    }
    async _servedMeshList() {
        const { meshes } = await this.listMeshes();
        const deviceId = this._requireDeviceKeyPair().publicKey;
        const foreign = [...this._meshes.values()]
            .map(({ mesh }) => mesh)
            .filter((mesh) => this._isForeign(mesh));
        const served = await Promise.all(foreign.map(async (mesh) => ((await servesAgents(mesh, deviceId)) ? mesh : null)));
        return {
            meshes: [
                ...(meshes ?? []),
                ...served
                    .filter((mesh) => mesh !== null)
                    .map((mesh) => this._foreignEntry(mesh))
            ]
        };
    }
    _foreignEntry(mesh) {
        return {
            meshId: this._meshIdOf(mesh),
            state: mesh.writable ? 'joined' : 'joining',
            writable: mesh.writable,
            open: true,
            account: false,
            members: mesh.membership.members,
            shared: false,
            workspace: false,
            served: true
        };
    }
    _definesAgents(mesh, { route }) {
        return ((route === 'put-agent' || route === 'put-tool-configs') &&
            mesh.role === 'workspace' &&
            this._hasPublic(mesh));
    }
    _routesToPublic(mesh, { route }) {
        return !!route && publicRoute(route) && this._hasPublic(mesh);
    }
    async _routedMesh(pooled, meshId, request) {
        const mesh = pooled ?? (await this._publicById(meshId)) ?? (await this._openPooledMesh(meshId));
        const follow = request.follow || (this._isAccount(mesh) && !!mesh.ourMemberId);
        return this._routesToPublic(mesh, request) ? this._publicOf(mesh, { ...request, follow }) : mesh;
    }
    async _publicById(meshId) {
        const account = this._accountMesh();
        if (!account) {
            return null;
        }
        for (const workspaceKey of await this._publicWorkspaces(account)) {
            if ((await this._publicRecord(account, workspaceKey))?.key !== meshId) {
                continue;
            }
            const workspaceId = b4a.toHex(workspaceKey);
            const scope = workspaceId === this._ownWorkspaceId ? account : this._pooled(workspaceId);
            const mesh = scope && (await this._publicOf(scope));
            return mesh && this._meshIdOf(mesh) === meshId ? mesh : null;
        }
        return null;
    }
    _meshStatusSource() {
        return {
            watch: (listener) => void this._statusListeners.add(listener),
            unwatch: (listener) => void this._statusListeners.delete(listener),
            snapshot: () => this._statusSnapshot(),
            leave: (meshId) => this.leaveMesh(meshId),
            acknowledgeKicked: () => this.acknowledgeKicked(),
            join: (invite) => this.joinMesh(invite),
            cancelJoin: () => this.cancelMeshJoin(),
            preview: (invite) => this.previewMeshInvite(invite),
            invite: async (member, meshId) => {
                if (!member) {
                    const device = await this.getMeshInvite({ meshId });
                    return { invite: device ? encodeMeshInvite(device) : undefined };
                }
                const target = meshId ? { meshId } : await this.sharedMesh();
                const invite = await this.getMeshInvite({ memberInvite: true, meshId: target.meshId });
                const notices = [target.notice, await this._occupancyNotice(target.meshId)];
                return {
                    invite: invite ? encodeMeshInvite(invite) : undefined,
                    meshId: target.meshId,
                    notice: notices.filter(Boolean).join('\n') || undefined
                };
            },
            list: () => this.listMeshes(),
            account: () => this.account(),
            open: (meshId) => this.openMesh(meshId),
            close: (meshId) => this.closeMesh(meshId),
            label: (meshId, label) => this.setMeshLabel(meshId, label),
            name: (meshId, name) => this.setMeshName(meshId, name),
            createMesh: (opts) => this.createMesh(opts),
            createWorkspace: (opts) => this.createWorkspace(opts),
            leaveWorkspace: (meshId) => this.leaveWorkspace(meshId),
            createProject: (workspaceId, opts) => this.createProject(workspaceId, opts),
            listArchived: () => this.listArchivedMeshes(),
            archivedContents: (meshId) => this.archivedMeshContents(meshId),
            migrateArchived: (meshId) => this.migrateArchivedMesh(meshId),
            recoverable: () => this.accountRecoverable(),
            publishRecovery: async (phrase) => void (await this.publishAccountRecovery(phrase)),
            recover: (phrase, timeout) => this.recoverAccount(phrase, { timeout }),
            displayName: () => this.displayName()
        };
    }
    _blindPeeringSource() {
        return {
            watch: (listener) => void this._blindPeeringListeners.add(listener),
            unwatch: (listener) => void this._blindPeeringListeners.delete(listener),
            snapshot: () => ({ enabled: this._blindPeeringOn }),
            set: (enabled) => this.setBlindPeering(enabled)
        };
    }
    _networkStatusSource() {
        const listeners = new Set();
        let timer = null;
        return {
            sampled: true,
            watch: (listener) => {
                listeners.add(listener);
                if (timer) {
                    return;
                }
                timer = setInterval(() => {
                    for (const fn of listeners) {
                        fn();
                    }
                }, DIAGNOSTICS_SAMPLE_MS);
                unref(timer);
            },
            unwatch: (listener) => {
                listeners.delete(listener);
                if (listeners.size === 0 && timer) {
                    clearInterval(timer);
                    timer = null;
                }
            },
            snapshot: () => this._networkSnapshot()
        };
    }
    _networkSnapshot() {
        const dht = this._swarm?.dht ?? null;
        return {
            state: this._networkState(dht),
            peerCount: this.peerDeviceIds.length
        };
    }
    _networkState(dht) {
        if (!dht?.online)
            return 'offline';
        if (dht.degraded)
            return 'degraded';
        return 'online';
    }
    _logSource() {
        const log = this._log;
        if (!log) {
            return null;
        }
        return {
            backfill: () => log.backfill(),
            subscribe: (listener) => log.subscribe(listener),
            unsubscribe: (listener) => log.unsubscribe(listener),
            write: (input) => log.appendClient({ ...input, originDeviceId: this.devicePublicKey ?? undefined })
        };
    }
    compact(force = false) {
        if (!force) {
            return this.storage.compact();
        }
        return this.storage.compact({
            blobGarbageCollectionPolicy: RocksConstants.garbageCollectionPolicy.FORCE,
            blobGarbageCollectionAgeCutoff: 1.0,
            bottommostLevelCompaction: RocksConstants.bottommostLevelCompaction.FORCE
        });
    }
    registerDiagnostics(provider) {
        this._diagnosticsProviders.add(provider);
        return () => void this._diagnosticsProviders.delete(provider);
    }
    registerModelResidency(residency) {
        this._modelResidency = residency;
        return () => {
            if (this._modelResidency === residency) {
                this._modelResidency = null;
            }
        };
    }
    registerModelUsers(users) {
        this._modelUsers = users;
        return () => {
            if (this._modelUsers === users) {
                this._modelUsers = null;
            }
        };
    }
    registerInferenceCalls(source) {
        this._inferenceCalls = source;
        return () => {
            if (this._inferenceCalls === source) {
                this._inferenceCalls = null;
            }
        };
    }
    registerListModels(hook) {
        this._listModels = hook;
        return () => {
            if (this._listModels === hook) {
                this._listModels = null;
            }
        };
    }
    registerModelMemory(hook) {
        this._modelMemory = hook;
        return () => {
            if (this._modelMemory === hook) {
                this._modelMemory = null;
            }
        };
    }
    registerDeleteModel(hook) {
        this._deleteModel = hook;
        return () => {
            if (this._deleteModel === hook) {
                this._deleteModel = null;
            }
        };
    }
    registerClearKvCache(hook) {
        this._clearKvCache = hook;
        return () => {
            if (this._clearKvCache === hook) {
                this._clearKvCache = null;
            }
        };
    }
    registerDeleteChatKvCache(hook) {
        this._deleteChatKvCache = hook;
        return () => {
            if (this._deleteChatKvCache === hook) {
                this._deleteChatKvCache = null;
            }
        };
    }
    registerCompactChat(hook) {
        this._compactChat = hook;
        return () => {
            if (this._compactChat === hook) {
                this._compactChat = null;
            }
        };
    }
    registerModelCatalogWatch(hook) {
        this._modelCatalogWatch = hook;
        this._openModelCatalogWatchSource();
        return () => {
            if (this._modelCatalogWatch !== hook)
                return;
            this._modelCatalogWatch = null;
            if (!this.closing) {
                this._resetModelCatalogWatchSource();
            }
        };
    }
    async *_watchModelCatalog() {
        const revisions = await this._modelCatalogRevisions();
        if (revisions) {
            yield* revisions;
        }
    }
    async _modelCatalogRevisions() {
        while (!this.closing) {
            const source = this._modelCatalogWatchSource;
            try {
                await source.ready();
            }
            catch {
                return null;
            }
            const watch = this._modelCatalogWatch;
            if (watch) {
                return watch();
            }
        }
        return null;
    }
    async _readModelList(request) {
        const models = await this._readModels(request);
        if (!models) {
            return null;
        }
        return { models, memory: (await this._modelMemory?.()) ?? undefined };
    }
    async _readModels({ excludeCustom, ...options }) {
        const list = await this._listModels?.(options);
        if (!list) {
            return null;
        }
        const models = list.models ?? [];
        return asEncoded(excludeCustom ? models.filter((model) => model.registrySource !== 'custom') : models);
    }
    _openModelCatalogWatchSource() {
        if (!this._modelCatalogWatch || !this._modelCatalogWatchSource.enter()) {
            return;
        }
        this._modelCatalogWatchSource.exit();
    }
    _resetModelCatalogWatchSource() {
        this._modelCatalogWatchSource = new ReadyGuard();
        void this._modelCatalogWatchSource.ready().catch(noop);
    }
    registerRetryModelDownload(hook) {
        this._retryModelDownload = hook;
        return () => {
            if (this._retryModelDownload === hook) {
                this._retryModelDownload = null;
            }
        };
    }
    registerSkills(hook) {
        this._skills = hook;
        return () => {
            if (this._skills === hook) {
                this._skills = null;
            }
        };
    }
    registerSkillCatalog(hook) {
        this._skillCatalog = hook;
        this._openCatalogHooks();
        return () => {
            if (this._skillCatalog === hook) {
                this._skillCatalog = null;
            }
        };
    }
    registerSkillManagement(hooks) {
        this._skillManagement = hooks;
        return () => {
            if (this._skillManagement === hooks) {
                this._skillManagement = null;
            }
        };
    }
    async _waitForCatalogHooks() {
        if (!this._hostsModelSource)
            return;
        await this._catalogHooks.ready();
    }
    _catalogHooksReady() {
        if (!this._hostsModelSource)
            return true;
        return this._skillCatalog !== null && this._tools !== null;
    }
    _openCatalogHooks() {
        if (!this._catalogHooksReady() || !this._catalogHooks.enter())
            return;
        this._catalogHooks.exit();
    }
    registerTools(hook) {
        this._tools = hook;
        this._openCatalogHooks();
        return () => {
            if (this._tools === hook) {
                this._tools = null;
            }
        };
    }
    registerEmbedder(embedder, extractors) {
        this._embedder = embedder;
        this._ragExtractors = extractors ?? this._ragExtractors;
        const settled = this._reconcileIndexing();
        settled.catch((err) => this._log?.warn(['indexing'], 'reconcile failed', err));
        return () => {
            if (this._embedder !== embedder)
                return settled;
            this._embedder = null;
            return this._reconcileIndexing();
        };
    }
    async _reconcileIndexing() {
        await this._indexingLock.lock();
        try {
            if (this.closing) {
                return;
            }
            if (this._indexedEmbedder && this._indexedEmbedder !== this._embedder) {
                await this._stopIndexing();
            }
            this._startIndexing();
        }
        finally {
            this._indexingLock.unlock();
        }
    }
    _startIndexing() {
        for (const entry of this._meshes.values()) {
            this._startEntryIndexing(entry);
        }
    }
    _startEntryIndexing(entry) {
        if (!this._embedder ||
            entry.processingFiles ||
            !inRole(entry.mesh.role, '@qvac/claim-indexing') ||
            this._isForeign(entry.mesh)) {
            return;
        }
        entry.vectorIndex ??= this._takeVectorIndex();
        entry.processingFiles = entry.mesh.files;
        entry.processingFiles.startProcessing({
            embedder: this._embedder,
            index: entry.vectorIndex,
            deviceId: this.devicePublicKey,
            device: this._indexingDevice,
            extractors: this._ragExtractors,
            batches: this._embedBatches
        });
        this._indexedEmbedder = this._embedder;
    }
    _takeVectorIndex() {
        const index = this._spareVectorIndex ?? new MemoryVectorIndex();
        this._spareVectorIndex = null;
        return index;
    }
    async _stopIndexing() {
        this._indexedEmbedder = null;
        for (const entry of this._meshes.values()) {
            await this._stopEntryIndexing(entry);
        }
    }
    registerTranscribe(hook) {
        this._transcribe = hook;
        return () => {
            if (this._transcribe === hook) {
                this._transcribe = null;
            }
        };
    }
    registerDetectLanguage(hook) {
        this._detectLanguage = hook;
        return () => {
            if (this._detectLanguage === hook) {
                this._detectLanguage = null;
            }
        };
    }
    registerPreviewModelSource(hook) {
        this._previewModelSource = hook;
        return () => {
            if (this._previewModelSource === hook) {
                this._previewModelSource = null;
            }
        };
    }
    registerSpeak(hook) {
        this._speak = hook;
        return () => {
            if (this._speak === hook) {
                this._speak = null;
            }
        };
    }
    registerSpeakStream(hook) {
        this._speakStream = hook;
        return () => {
            if (this._speakStream === hook) {
                this._speakStream = null;
            }
        };
    }
    _diagnosticsSource() {
        const listeners = new Set();
        let timer = null;
        return {
            sampled: true,
            watch: (listener) => {
                listeners.add(listener);
                if (timer) {
                    return;
                }
                timer = setInterval(() => {
                    for (const fn of listeners) {
                        fn();
                    }
                }, DIAGNOSTICS_SAMPLE_MS);
                unref(timer);
            },
            unwatch: (listener) => {
                listeners.delete(listener);
                if (listeners.size === 0 && timer) {
                    clearInterval(timer);
                    timer = null;
                }
            },
            snapshot: () => {
                const merged = { ...this._diagnostics() };
                for (const provider of this._diagnosticsProviders) {
                    Object.assign(merged, provider());
                }
                return merged;
            }
        };
    }
    _memberDiagnostics(mesh) {
        const memberId = mesh.ourMemberId;
        const root = this._identityPublicKey;
        return {
            ...mesh.membership,
            memberId: memberId ? b4a.toHex(memberId) : null,
            mintedOurRoot: !!memberId && !!root && b4a.equals(memberId, root)
        };
    }
    _meshDiagnostics(mesh) {
        return {
            key: b4a.toHex(mesh.key),
            discoveryKey: b4a.toHex(mesh.discoveryKey),
            writable: mesh.writable,
            localLength: mesh.localLength,
            systemLength: mesh.autobee.system.bee.head()?.length ?? 0,
            viewLength: mesh.view.db.head()?.length ?? 0,
            flushes: mesh.autobee.system.flushes,
            fastForwards: mesh.autobee.stats.fastForwards,
            stats: { ...mesh.autobee.stats },
            writers: mesh.writerCount,
            bootFrom: mesh.bootFrom,
            uptimeMs: mesh.uptimeMs,
            blindPeersConnected: mesh.blindPeersConnected(),
            member: this._memberDiagnostics(mesh),
            orphanedBlobSweep: mesh.orphanedBlobSweepStatus,
            blindPeering: this._blindPeeringOn,
            blindPeerCount: mesh.blindPeerKeys.length,
            blindPeers: mesh.blindPeerStats()
        };
    }
    _diagnostics() {
        const mesh = this._accountMesh();
        const publicMesh = this._publicMesh();
        const swarm = this._swarm;
        const dht = swarm?.dht ?? null;
        const system = this._systemInfo?.snapshot() ?? { cpu: null, gpu: null };
        const publicKey = this.devicePublicKey ? b4a.toHex(this.devicePublicKey) : undefined;
        const device = this._localDevice;
        return {
            device: publicKey,
            deviceInfo: device && publicKey
                ? {
                    publicKey,
                    name: device.name,
                    capabilityProfile: device.capabilityProfile,
                    recommendedModelName: device.recommendedModelName
                }
                : null,
            state: this._statusState(),
            mesh: mesh ? this._meshDiagnostics(mesh) : null,
            publicMesh: publicMesh ? this._meshDiagnostics(publicMesh) : null,
            network: dht
                ? {
                    online: dht.online ?? null,
                    degraded: dht.degraded ?? null,
                    nodes: dht.nodes?.length ?? 0,
                    host: dht.host,
                    port: dht.port,
                    connections: this._peers.size,
                    peers: this.peerDeviceIds.length,
                    stats: dht.stats,
                    health: dht.health?.stats ?? null,
                    config: dht.config ?? null
                }
                : null,
            process: top.toJSON(),
            cpu: system.cpu,
            gpu: system.gpu
        };
    }
    _statusSnapshot() {
        const peerDeviceIds = [...this.peerDeviceIds];
        const blindPeers = [...(this._blindPeering?.blindPeers.values() ?? [])];
        return {
            state: this._statusState(),
            peerCount: peerDeviceIds.length,
            peerDeviceIds,
            kickedPending: this._kickedPending,
            error: this._statusError ?? undefined,
            blindPeersConnected: blindPeers.filter((peer) => peer.connected).length,
            blindPeersTotal: blindPeers.length
        };
    }
    acknowledgeKicked() {
        if (!this._kickedPending)
            return;
        this._kickedPending = false;
        this._notifyStatus();
    }
    _statusState() {
        if (this._statusError)
            return 'error';
        if (this.closing || this._leaving)
            return 'leaving';
        if (this._kicked) {
            return 'kicked';
        }
        if (this._upgradeRequired) {
            return 'needs-upgrade';
        }
        if (this._minting) {
            return 'joining';
        }
        if (this._accountMesh()) {
            return this._accountWritable() ? 'joined' : 'joining';
        }
        return 'idle';
    }
    _accountWritable() {
        return !!this._accountMesh()?.writable && !!this._publicMesh()?.writable;
    }
    async _chatSenders(meshId) {
        const project = this._pooled(meshId);
        const session = project ? await this.local.readMeshSession(project.key) : null;
        const workspaceKey = session?.workspaceKey;
        const workspace = workspaceKey ? this._pooled(b4a.toHex(workspaceKey)) : null;
        return project && workspace ? projectSenders(workspace.view, project.view) : null;
    }
    _notifySenders() {
        for (const listener of [...this._senderListeners]) {
            listener();
        }
    }
    _notifyStatus() {
        this._listing = null;
        for (const settle of [...this._publicWaiters]) {
            settle();
        }
        for (const listener of [...this._statusListeners]) {
            listener();
        }
    }
}
function unmarkedNotice(losers) {
    if (losers.length === 0)
        return undefined;
    const ids = losers.map((mesh) => b4a.toHex(mesh.meshKey).slice(0, 8)).join(', ');
    return `another device of yours opened a shared mesh at the same moment, so ${ids} is an ordinary mesh now`;
}
function noop() { }
async function earliestPaired(account, rows) {
    const paired = [];
    for (const row of rows) {
        const device = await account.view.get(DEVICES, { id: row.id });
        if (device && !device.revoked) {
            paired.push(device);
        }
    }
    return paired.sort((a, b) => a.joinedAt - b.joinedAt || b4a.compare(a.id, b.id))[0];
}
function ownedBy(device, member) {
    const owner = device?.memberId ?? device?.claimedMemberId;
    return !!owner && !!member && b4a.equals(owner, member);
}
function isPeerConnection(conn) {
    return 'remotePublicKey' in conn;
}
async function closeConfigReader(reader) {
    if (!reader)
        return;
    await reader.core.close().catch(noop);
    await reader.close().catch(noop);
}
async function recordedBlockIsLocal(core) {
    await raceResource(core, core.ready(), 'config core');
    const length = Number((await raceResource(core, core.getUserData('hyperconf'), 'config core')) || '0');
    if (length <= 0) {
        return true;
    }
    return raceResource(core, core.has(length - 1), 'config core');
}
function statusErrorMessage(context, err) {
    const detail = errorDetail(err);
    return detail ? `${context}: ${detail}` : context;
}
function errorDetail(err) {
    if (err instanceof Error)
        return err.message;
    return err ? String(err) : '';
}
function credentialKeysOwnedElsewhere(skills, skillName) {
    const keys = new Set();
    for (const entry of skills) {
        if (entry.name === skillName)
            continue;
        for (const slot of entry.credentials ?? []) {
            for (const key of slot.split('|')) {
                keys.add(key);
            }
        }
        for (const route of entry.setup?.routes ?? []) {
            if (route.credentialKey) {
                keys.add(route.credentialKey);
            }
        }
    }
    return keys;
}
