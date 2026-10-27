import Autobee, {} from 'autobee';
import BlindPeering from 'blind-peering';
import Corestore from 'corestore';
import HyperDB from 'hyperdb';
import { ERRORS } from 'hyperdispatch/runtime';
import Hyperblobs from 'hyperblobs';
import crypto from 'hypercore-crypto';
import HypercoreId from 'hypercore-id-encoding';
import ReadyResource from 'ready-resource';
import { Files } from './files/index.js';
import MeshDefinition from '../../spec/mesh/hyperdb/index.js';
import { Router, encode } from '../../spec/mesh/hyperdispatch/index.js';
import { syncChanges } from './sync/index.js';
import { ViewUpdates } from './sync/view-updates.js';
import { BackgroundSync } from './sync/background.js';
import { buildDefaultSeed, isOwnKickedRow, isOwnRevokedRow } from './helpers/index.js';
import { raceResource } from '../race-resource.js';
import { signDeviceAttestation, signWriterClaim, verifyWriterClaim } from './device-attestation.js';
import { devicesByWriterKey, liveDeviceForWriter } from './contract/activity.js';
import { MESH_NAME_ROW } from './contract/mesh-name.js';
import { versionedOp } from './contract/oldest-version.js';
import { KNOWN_RULES, rulesVersion } from './contract/mesh-rules.js';
import { WORKSPACE_ROW } from './contract/workspace.js';
import { registerRoutes } from './contract/index.js';
import { assertRoleRoute, inRole } from './contract/roles.js';
import { createSyncActivity } from './sync-status.js';
import { buildHealthAssistant } from './health-assistant.js';
import b4a from 'b4a';
import { errorMessage, isRecord } from '../guards.js';
import { CoreError, isCoreError } from '../errors.js';
import { ACTIVE_AGENTS, ACTIVE_CHATS, DEVICES, LIVE_WRITERS_BY_MOST_RECENT, MEMBERS, MESH_NAMES } from './collections.js';
const [MESH_KEYPAIR, MESH_ENCRYPTION, MESH_DEVICE] = crypto.namespace('qvac-assistant/mesh', 3);
const DEFAULT_NAMESPACE = b4a.alloc(32);
const SLOW_WRITE_MS = 5000;
const SLOW_DRAIN_MS = 15_000;
const SYNC_BATCH = 64;
const SYNC_PAUSE_MS = 100;
const BLOB_CORE = 'qvac-blobs';
export function meshPublicKeyFromSeed(seed) {
    return crypto.keyPair(crypto.hash([MESH_KEYPAIR, seed])).publicKey;
}
async function ownCores(storage, namespace, writerKey) {
    const keys = [crypto.discoveryKey(writerKey)];
    for await (const discoveryKey of storage.createDiscoveryKeyStream(namespace)) {
        keys.push(discoveryKey);
    }
    const views = `autobee/${HypercoreId.encode(writerKey)}/`;
    for await (const { alias, discoveryKey } of storage.createAliasStream(DEFAULT_NAMESPACE)) {
        if (alias.name.startsWith(views)) {
            keys.push(discoveryKey);
        }
    }
    return keys;
}
const WARMUP_COLLECTIONS = [
    '@qvac/devices',
    '@qvac/active-agents',
    '@qvac/members',
    '@qvac/active-chats'
];
export async function isOurTrustedWriter(snap, writerKey, ourMemberId) {
    const device = await liveDeviceForWriter(snap, writerKey);
    if (!device) {
        return false;
    }
    if (!ourMemberId) {
        return true;
    }
    return !!device.memberId && b4a.equals(device.memberId, ourMemberId);
}
export function claimableDevice(row) {
    return {
        id: row.id,
        joinedAt: row.joinedAt,
        name: row.name,
        capabilityProfile: row.capabilityProfile,
        recommendedModelName: row.recommendedModelName
    };
}
export class Mesh extends ReadyResource {
    _files = null;
    get files() {
        this._files ??= new Files(this);
        return this._files;
    }
    _store;
    _namespaceId = null;
    _seed;
    _role;
    _key;
    _writerSeed;
    _log;
    _blindPeerKeys;
    _bootFrom;
    _wakeup;
    attachmentUrl;
    fileIndex;
    _scope;
    router;
    _keyPair;
    _deviceKeyPair;
    _encryptionKey;
    _blindPeering = null;
    openedEmpty = false;
    foreign = false;
    workspaceKey = null;
    _updates;
    _openedAt = 0;
    _trustedDevice;
    _joined = false;
    _orphanedBlobSweepStatus = { state: 'pending' };
    _bootInterrupted = false;
    _localWriterUploadedLength = 0;
    _ourMemberId = null;
    _name = null;
    _membership = {
        members: 0,
        attested: 0,
        unattested: 0,
        revoked: 0
    };
    _deviceId;
    _slowWriteMs;
    _slowDrainMs;
    _stallReported = false;
    _admitted = false;
    _birth = null;
    _rulesRaised = null;
    _autobee = null;
    _blobs = null;
    _syncActivity = null;
    _background;
    discoveryKey;
    get autobee() {
        return openedPart(this._autobee, 'autobee');
    }
    get blobs() {
        return openedPart(this._blobs, 'blobs');
    }
    get syncActivity() {
        return openedPart(this._syncActivity, 'syncActivity');
    }
    get publicKey() {
        return this._keyPair.publicKey;
    }
    get log() {
        return this._log;
    }
    get devicePublicKey() {
        return this._deviceKeyPair.publicKey;
    }
    get key() {
        return this.autobee.key;
    }
    get role() {
        return this._role;
    }
    get encryptionKey() {
        return this._encryptionKey;
    }
    get seed() {
        return this._seed;
    }
    get blindPeerKeys() {
        return this._blindPeerKeys;
    }
    get orphanedBlobSweepStatus() {
        return this._orphanedBlobSweepStatus;
    }
    blindPeerStats() {
        const peering = this._blindPeering;
        if (!peering?.blindPeers) {
            return [];
        }
        const own = new Set(this._blindPeerKeys.map((key) => b4a.toHex(key)));
        return [...peering.blindPeers.values()]
            .filter((bp) => own.has(b4a.toHex(bp.remotePublicKey)))
            .map((bp) => ({
            key: b4a.toHex(bp.remotePublicKey).slice(0, 16),
            connected: bp.connected,
            connects: bp.connects,
            uploaded: bp.uploaded
        }));
    }
    get ourMemberId() {
        return this._ourMemberId;
    }
    get ourDeviceId() {
        return this._deviceId;
    }
    get membership() {
        return this._membership;
    }
    tallyMembership() {
        this.refreshMembership()
            .then(() => this.emit('membership-tallied'))
            .catch((err) => this._log?.warn(this._scope, 'tallying membership failed', err));
    }
    async refreshMembership() {
        const snap = this.view.snapshot();
        try {
            let members = 0;
            let attested = 0;
            let unattested = 0;
            let revoked = 0;
            for await (const _member of snap.find(MEMBERS)) {
                members++;
            }
            for await (const device of snap.find(DEVICES)) {
                if (device.revoked) {
                    revoked++;
                }
                else if (device.memberId) {
                    attested++;
                }
                else {
                    unattested++;
                }
            }
            this._membership = {
                members,
                attested,
                unattested,
                revoked
            };
        }
        finally {
            await snap.close();
        }
    }
    async refreshOurMember() {
        if (!this._deviceId)
            return null;
        const own = await this.view.get(DEVICES, { id: this._deviceId });
        this._ourMemberId = own?.memberId ?? null;
        if (own?.memberId && own.memberProof) {
            const membership = {
                memberId: own.memberId,
                proof: own.memberProof,
                attestedAt: own.attestedAt || 0
            };
            this.emit('membership', membership);
        }
        return own;
    }
    get name() {
        return this._name;
    }
    async refreshName() {
        this._name = await this.view.get(MESH_NAMES, { id: MESH_NAME_ROW });
    }
    async setName(name) {
        const current = await this.view.get(MESH_NAMES, { id: MESH_NAME_ROW });
        await this.dispatch('name-mesh', {
            name,
            namedAt: Math.max(Date.now(), (current?.namedAt ?? 0) + 1)
        });
    }
    sign(message) {
        return crypto.sign(message, this._keyPair.secretKey);
    }
    attestDevice(deviceId) {
        return signDeviceAttestation(this._deviceKeyPair.secretKey, deviceId);
    }
    constructor(store, opts = {}) {
        super();
        this._store = store;
        this._seed = opts.seed ?? crypto.randomBytes(32);
        this._role = opts.role ?? 'account';
        this._key = opts.key ?? null;
        this._writerSeed = opts.writerSeed;
        this._log = opts.logger ?? null;
        this._slowWriteMs = opts.slowWriteMs ?? SLOW_WRITE_MS;
        this._slowDrainMs = opts.slowDrainMs ?? SLOW_DRAIN_MS;
        this._blindPeerKeys = opts.blindPeerKeys ?? [];
        this._bootFrom = opts.bootFrom;
        this._trustedDevice = opts.trustedDevice ?? null;
        this._deviceId = opts.deviceId ?? null;
        this._wakeup = opts.wakeup;
        this.attachmentUrl = opts.attachmentUrl ?? null;
        this.fileIndex = opts.fileIndex ?? null;
        this._updates = new ViewUpdates((update) => this._syncUpdate(update), opts.pendingUpdates);
        this.router = new Router();
        this._keyPair = crypto.keyPair(crypto.hash([MESH_KEYPAIR, this._seed]));
        this._deviceKeyPair = crypto.keyPair(crypto.hash([MESH_DEVICE, this._seed]));
        this._encryptionKey = crypto.hash([MESH_ENCRYPTION, this._seed]);
        this.discoveryKey = crypto.discoveryKey(this._keyPair.publicKey);
        this._scope = ['p2p', 'mesh', b4a.toHex(this._keyPair.publicKey).slice(0, 8)];
        registerRoutes(this.router, { role: this._role });
        this._background = new BackgroundSync(this, {
            batch: opts.syncBatch ?? SYNC_BATCH,
            pauseMs: opts.syncPauseMs ?? SYNC_PAUSE_MS,
            logger: this._log,
            scope: this._scope
        });
    }
    async _open() {
        this._openedAt = Date.now();
        this._log?.info(this._scope, 'opening', {
            creator: this._key === null,
            role: this._role,
            bootFrom: this._bootFrom?.length ?? null,
            blindPeers: this._blindPeerKeys.length
        });
        const namespace = this._store.namespace(this.discoveryKey);
        this._namespaceId = namespace.ns;
        const blobCore = namespace.get({
            name: await this._blobCoreName(namespace),
            encryptionKey: this._encryptionKey
        });
        const blobs = new Hyperblobs(blobCore);
        this._blobs = blobs;
        try {
            await raceResource(blobs.core, blobs.ready(), 'blobs');
            this._log?.info(this._scope, 'blob store opened', {
                blobs: blobs.core.length,
                sinceOpenMs: this._sinceOpen()
            });
            const writerKeyPair = await namespace.createKeyPair(this._writerSeed ?? 'local');
            const autobee = new Autobee(namespace, this._key, {
                open: this._autobeeOpen.bind(this),
                apply: this._autobeeApply.bind(this),
                update: this._autobeeUpdate.bind(this),
                warmup: this._autobeeWarmup.bind(this),
                isTrusted: this._autobeeIsTrusted.bind(this),
                mostRecentTrusted: this._autobeeMostRecentTrusted.bind(this),
                keyPair: writerKeyPair,
                encrypted: true,
                encryptionKey: this._encryptionKey,
                wakeupCapability: { key: this._keyPair.publicKey, discoveryKey: this.discoveryKey },
                wakeup: this._wakeup,
                fastForward: { boot: this._bootFrom ? { head: this._bootFrom } : null },
                strictReindex: true
            });
            this._autobee = autobee;
            this.autobee.on('error', (err) => this._log?.warn(this._scope, 'autobee error', err));
            this.autobee.on('writable', () => {
                void this.checkOwnAdmission().catch(noop);
                this._raiseRulesLater();
            });
            this.autobee.on('move-to', (to, from) => this._log?.info(this._scope, 'fast-forwarded onto a head', {
                from: from?.length ?? 0,
                to: to?.length ?? 0,
                fastForwards: this.autobee.stats.fastForwards,
                sinceOpenMs: this._sinceOpen()
            }));
            this.autobee.on('interrupt', (err) => this._log?.warn(this._scope, 'autobee interrupt', err));
            if (this._bootInterrupted) {
                void this.autobee.close().catch(noop);
            }
            await raceResource(this.autobee, this.autobee.ready(), 'autobee');
        }
        catch (err) {
            await this._autobee?.close().catch(noop);
            await blobs.close().catch(noop);
            throw err;
        }
        this.autobee.bootstrap.on('peer-add', () => this.emit('peer-add'));
        this.openedEmpty = !this.view.db.head()?.length;
        this.autobee.local.on('upload', (index) => {
            this._localWriterUploadedLength = Math.max(this._localWriterUploadedLength, index + 1);
        });
        this._syncActivity = createSyncActivity(this);
        void this.refreshOurMember().catch((err) => this._log?.warn(this._scope, 'reading our member failed', err));
        this._log?.info(this._scope, 'autobee opened', {
            writable: this.autobee.writable,
            creator: this._key === null,
            ...this._lengths(),
            fastForwards: this.autobee.stats.fastForwards,
            writers: this.writerCount,
            sinceOpenMs: this._sinceOpen()
        });
        void this._updates
            .start()
            .catch((err) => this._log?.warn(this._scope, 'resuming the view sync failed', err));
        if (!this.foreign) {
            void this._sweepOrphanedBlobs(this.blobs.core.length);
        }
        this._raiseRulesLater();
        this.files.start({ deviceId: this._deviceId });
    }
    startBlindPeering(peering) {
        if (this.closing || this._blindPeering || !this._autobee || !this._blobs) {
            return;
        }
        this._blindPeering = peering;
        peering.addAutobaseBackground(this._autobee, {
            target: this._keyPair.publicKey,
            keys: this._blindPeerKeys,
            pick: 2
        });
        peering.addCoreBackground(this._blobs.core, {
            target: this._keyPair.publicKey,
            keys: this._blindPeerKeys,
            pick: 2
        });
        this._log?.info(this._scope, 'blind peering started', { peers: this._blindPeerKeys.length });
    }
    stopBlindPeering() {
        if (!this._blindPeering) {
            return;
        }
        this._blindPeering = null;
        this._log?.info(this._scope, 'blind peering stopped', { peers: this._blindPeerKeys.length });
    }
    get bootFrom() {
        return this._bootFrom?.length ?? null;
    }
    async wakeHeldWriters() {
        for await (const writer of this.autobee.system.list()) {
            if (!writer.isRemoved) {
                this.autobee.writers.wakeup(writer.key, 0);
            }
        }
    }
    get writerCount() {
        let count = 0;
        for (const _ of this.autobee.activeWriters) {
            count++;
        }
        return count;
    }
    get uptimeMs() {
        return this._openedAt ? this._sinceOpen() : 0;
    }
    blindPeersConnected() {
        return this.blindPeerStats().filter((peer) => peer.connected).length;
    }
    _sinceOpen() {
        return Date.now() - this._openedAt;
    }
    _lengths() {
        return {
            localLength: this.autobee.local.length,
            systemLength: this.autobee.system.bee.head()?.length ?? 0,
            viewLength: this.view.db.head()?.length ?? 0,
            viewCore: viewCoreOf(this.view.db.head()),
            flushes: this.autobee.system.flushes
        };
    }
    async _blobCoreName(namespace) {
        if (this._role !== 'project' || !this._writerSeed) {
            return BLOB_CORE;
        }
        const storage = this._store.storage;
        const shared = await storage.getAlias({ name: BLOB_CORE, namespace: namespace.ns });
        return shared ? BLOB_CORE : `${BLOB_CORE}/${this._writerSeed}`;
    }
    ownCoreDiscoveryKeys(storage) {
        const namespace = this._namespaceId;
        if (!namespace) {
            return Promise.resolve([]);
        }
        return ownCores(storage, namespace, this.autobee.local.key);
    }
    async openBlobs(coreKey) {
        const core = this._store.get({ key: coreKey, encryptionKey: this._encryptionKey });
        const blobs = new Hyperblobs(core);
        await blobs.ready();
        return blobs;
    }
    interruptBoot() {
        this._bootInterrupted = true;
        if (this._autobee) {
            void this._autobee.close().catch(noop);
        }
    }
    async _close() {
        this._updates.close();
        this._log?.info(this._scope, 'closing', {
            sinceOpenMs: this._sinceOpen(),
            ...this._lengths(),
            ...this.autobee.stats
        });
        this._background.stop();
        await this._files?.close();
        await Promise.all([this.autobee.close(), this.blobs.close()]);
        this._blindPeering = null;
    }
    async _sweepOrphanedBlobs(blobLength) {
        this._orphanedBlobSweepStatus = { state: 'running' };
        try {
            await this._watchStall(this.autobee.update(), { what: 'mesh drain', ms: this._slowDrainMs });
            await this.files.sweepOrphans(blobLength);
            this._orphanedBlobSweepStatus = { state: 'succeeded' };
            this._log?.info(this._scope, 'orphaned blob sweep finished');
        }
        catch (err) {
            if (this.closing) {
                return;
            }
            const error = errorMessage(err);
            this._orphanedBlobSweepStatus = { state: 'failed', error };
            this._log?.warn(this._scope, 'orphaned blob sweep failed', err);
        }
    }
    get view() {
        return this.autobee.view.db;
    }
    get localWriterKey() {
        return this.autobee.local.key;
    }
    signDeviceClaim(secretKey, deviceId, joinedAt) {
        return signWriterClaim(secretKey, {
            meshPublicKey: this.publicKey,
            deviceId,
            writerKey: this.localWriterKey,
            joinedAt
        });
    }
    get minted() {
        return b4a.equals(this.autobee.key, this.autobee.local.key);
    }
    get writable() {
        return this.autobee.writable;
    }
    get localLength() {
        return this.autobee.local.length;
    }
    get joining() {
        return this._birth !== null;
    }
    async dispatch(name, payload, opts) {
        assertRoleRoute(this._role, name);
        assertJoined(this.autobee, opts);
        const write = this.autobee.append(encode(`@qvac/${name}`, versionedOp(name, payload)), opts);
        await this._watchStall(write, { what: 'mesh write', op: name, ms: this._slowWriteMs });
    }
    async _watchStall(pending, watch) {
        const started = Date.now();
        let reported = false;
        const timer = setTimeout(() => {
            if (this._stallReported) {
                return;
            }
            this._stallReported = true;
            reported = true;
            this._reportStall(watch, started).catch(noop);
        }, watch.ms);
        try {
            await pending;
            this._endStall(watch, { reported, started, failed: false });
        }
        catch (err) {
            this._endStall(watch, { reported, started, failed: true, err });
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    _endStall({ what, op }, { reported, started, failed, err }) {
        if (!reported) {
            return;
        }
        this._stallReported = false;
        const ms = Date.now() - started;
        if (failed) {
            this._log?.warn(this._scope, `${what} failed`, { op, ms, err });
        }
        else {
            this._log?.info(this._scope, `${what} settled`, { op, ms });
        }
    }
    async _reportStall({ what, op }, started) {
        const { stats, system } = this.autobee;
        const missing = await this._coresNotHeld([system.bee, this.autobee.bee]).catch(noop);
        this._log?.warn(this._scope, `${what} still pending`, {
            op,
            afterMs: Date.now() - started,
            writable: this.autobee.writable,
            interrupted: !!this.autobee.interrupted,
            drains: stats.drains,
            applies: stats.applies,
            appends: stats.appends,
            fastForwards: stats.fastForwards,
            localLength: this.autobee.local.length,
            missing,
            blindPeers: this.blindPeerStats()
        });
    }
    async _coresNotHeld(views) {
        const keys = new Map();
        for (const { context } of views) {
            for (const { key } of [context.core, ...context.cores]) {
                keys.set(b4a.toHex(key), key);
            }
        }
        const held = await Promise.all([...keys.values()].map((key) => this._coreHeld(key)));
        return held.filter((core) => core.held < core.length);
    }
    async _coreHeld(key) {
        const core = this._store.get({ key, active: false });
        try {
            await core.ready();
            return {
                key: b4a.toHex(key).slice(0, 8),
                length: core.length,
                held: core.contiguousLength,
                peers: core.peers.length
            };
        }
        finally {
            await core.close();
        }
    }
    batch() {
        return new MeshBatch(this.autobee, {
            role: this._role,
            joined: true,
            watch: (op, write) => this._watchStall(write, { what: 'mesh write', op, ms: this._slowWriteMs })
        });
    }
    _raiseRulesLater() {
        if (this._rulesRaised || !this.autobee.writable)
            return;
        if (this.minted && this.localLength === 0) {
            this._rulesRaised = Promise.resolve();
            return;
        }
        this._rulesRaised = this._raiseRules().catch((err) => {
            if (!this.closing) {
                this._log?.warn(this._scope, 'raising the mesh rules failed', err);
            }
        });
    }
    async _raiseRules() {
        await this.autobee.update();
        if ((await rulesVersion(this.view)) >= KNOWN_RULES) {
            return;
        }
        await this.dispatch('raise-mesh-rules', { rules: KNOWN_RULES });
    }
    appendBirthOp(identity, device, opts = {}) {
        this._birth ??= (async () => {
            await this._appendBirthOp(identity, device, typeof opts === 'function' ? await opts() : opts);
        })().finally(() => {
            this._birth = null;
        });
        return this._birth.then(() => this._settleBirth());
    }
    async _settleBirth() {
        const started = Date.now();
        await this.autobee.update();
        this.throwIfInterrupted();
        const { applies, undos, drains, fastForwards } = this.autobee.stats;
        this._log?.info(this._scope, 'joined', {
            ms: Date.now() - started,
            applies,
            undos,
            drains,
            fastForwards,
            ...this._lengths(),
            sinceOpenMs: this._sinceOpen()
        });
        this._joined = true;
        this.emit('joined');
    }
    get joined() {
        return this._joined;
    }
    async _appendBirthOp(identity, device, { member, sharing = false, defaults = true, workspace, project } = {}) {
        if (this.autobee.local.length > 0)
            return;
        const { publicKey: deviceId, secretKey } = 'secretKey' in identity ? identity : { publicKey: identity, secretKey: null };
        const localKey = this.autobee.local.key;
        const row = device
            ? { id: deviceId, joinedAt: Date.now(), ...device }
            : undefined;
        const deviceSignature = secretKey && row ? this.signDeviceClaim(secretKey, deviceId, row.joinedAt) : undefined;
        if (this._key === null) {
            const birth = new MeshBatch(this.autobee, { role: this._role });
            birth.dispatch('raise-mesh-rules', { rules: KNOWN_RULES });
            birth.dispatch('add-writer', { writerKey: localKey, device: row, deviceSignature });
            if (sharing || this._role === 'public') {
                birth.dispatch('mint-mesh-kind', { id: 'mesh', kind: this._bornKind(project) });
            }
            if (row) {
                birth.dispatch('attest-device', this.attestDevice(deviceId));
                if (member) {
                    birth.dispatch('mint-member', member);
                }
                if (workspace) {
                    const { name, icon } = workspace;
                    birth.dispatch('put-workspace', {
                        workspace: { id: WORKSPACE_ROW, icon, updatedAt: row.joinedAt }
                    });
                    birth.dispatch('name-mesh', { name, namedAt: row.joinedAt });
                }
                if (project && member) {
                    birth.dispatch('put-project-member', {
                        memberId: member.member.id,
                        addedAt: project.upgraded ? undefined : row.joinedAt
                    });
                    birth.dispatch('name-mesh', { name: project.name, namedAt: row.joinedAt });
                }
                if (!sharing) {
                    this._seedDefaults(birth, row, defaults);
                }
            }
            await birth.flush();
        }
        else if (!this.autobee.writable) {
            const join = new MeshBatch(this.autobee, { role: this._role });
            join.dispatch('open-join', {
                signature: this.sign(localKey),
                deviceId,
                device: row ? claimableDevice(row) : undefined,
                deviceSignature,
                member: member?.member,
                memberClaim: member?.proof
            });
            if (row) {
                join.dispatch('attest-device', this.attestDevice(deviceId));
            }
            await join.flush({ optimistic: true });
        }
    }
    _bornKind(project) {
        if (project) {
            return 'project';
        }
        return this._role === 'workspace' || this._role === 'public' ? this._role : 'shared';
    }
    _seedDefaults(birth, row, defaults) {
        if (!inRole(this._role, '@qvac/seed-defaults')) {
            for (const key of this._blindPeerKeys) {
                birth.dispatch('put-mesh-blind-peer', { key });
            }
            return;
        }
        if (!defaults) {
            return;
        }
        const peers = inRole(this._role, '@qvac/put-mesh-blind-peer') ? this._blindPeerKeys : [];
        birth.dispatch('seed-defaults', buildDefaultSeed(row, peers));
        birth.dispatch('put-agent', { agent: buildHealthAssistant(row) });
    }
    get interrupted() {
        return this.autobee.interrupted;
    }
    throwIfInterrupted() {
        if (this.interrupted) {
            throw this.interrupted;
        }
    }
    async waitForWritable(timeout) {
        if (this.closing || this.autobee.writable)
            return;
        await new Promise((resolve) => {
            const done = () => {
                clearTimeout(timer);
                this.autobee.off('writable', done);
                this.off('close', done);
                resolve();
            };
            const timer = timeout === undefined ? undefined : setTimeout(done, timeout);
            this.autobee.on('writable', done);
            this.on('close', done);
        });
    }
    pendingUploads() {
        const peers = this.autobee.local.peers;
        if (this.closing || peers.length === 0) {
            return 0;
        }
        const taken = Math.max(this._localWriterUploadedLength, ...peers.map((peer) => peer.remoteLength));
        return Math.max(0, this.autobee.local.length - taken);
    }
    async suspend() {
        this._background.pause();
        await this._files?.suspend();
    }
    resume() {
        this._background.resume();
        this._files?.resume();
    }
    syncInBackground({ focus } = {}) {
        return this._background.run(focus);
    }
    focusChat(chatId) {
        this._background.focus(chatId);
    }
    pickedFrom = null;
    syncChatOrder = null;
    chatOrderBuilt = Promise.resolve();
    watch(listener) {
        this.view.watch(listener);
    }
    unwatch(listener) {
        this.view.unwatch(listener);
    }
    async _autobeeIsTrusted(key, reference) {
        if (this.closing)
            return false;
        const snap = reference.db.snapshot();
        try {
            const trusted = await isOurTrustedWriter(snap, key, this._ourMemberId);
            if (!trusted) {
                this._log?.debug(this._scope, 'writer is no device of ours', {
                    writerKey: b4a.toHex(key).slice(0, 16)
                });
            }
            return trusted;
        }
        finally {
            await snap.close();
        }
    }
    async _autobeeMostRecentTrusted(target, reference) {
        if (this.closing)
            return null;
        const snap = (reference ?? target).db.snapshot();
        try {
            for await (const writer of target.db.find(LIVE_WRITERS_BY_MOST_RECENT, {
                reverse: true
            })) {
                if ((await isOurTrustedWriter(snap, writer.writerKey, this._ourMemberId)) ||
                    (await this._vouchedByItsRow(target, reference, writer.writerKey))) {
                    this._log?.debug(this._scope, 'vouching for a head', {
                        writerKey: b4a.toHex(writer.writerKey).slice(0, 16),
                        length: writer.length
                    });
                    return { key: writer.writerKey, length: writer.length };
                }
            }
            this._log?.debug(this._scope, 'vouching for no head: no writer of ours has been active');
            return null;
        }
        finally {
            await snap.close();
        }
    }
    async _vouchedByItsRow(target, reference, writerKey) {
        if (!reference ||
            !this._trustedDevice ||
            (await devicesByWriterKey(reference.db, writerKey).one())) {
            return false;
        }
        const device = await liveDeviceForWriter(target.db, writerKey);
        if (!device?.deviceSignature) {
            return false;
        }
        const binding = {
            meshPublicKey: this.publicKey,
            deviceId: device.id,
            writerKey,
            joinedAt: device.joinedAt
        };
        if (!verifyWriterClaim(device.deviceSignature, binding) ||
            !(await this._trustedDevice(device.id))) {
            return false;
        }
        this._log?.debug(this._scope, 'writer vouched by its row', {
            writerKey: b4a.toHex(writerKey).slice(0, 16),
            deviceId: b4a.toHex(device.id).slice(0, 16)
        });
        return true;
    }
    _autobeeOpen(bee) {
        const db = HyperDB.bee2(bee, MeshDefinition, { autoUpdate: true });
        return { db };
    }
    async _autobeeWarmup(view) {
        try {
            const counts = await Promise.all(WARMUP_COLLECTIONS.map((collection) => drain(view.db.find(collection))));
            const warmed = counts.reduce((total, count) => total + count, 0);
            this._log?.info(this._scope, 'warmed candidate view', {
                warmed,
                length: view.db.db.head()?.length ?? 0,
                sinceOpenMs: this._sinceOpen()
            });
            this.emit('warmup', { warmed });
        }
        catch (err) {
            this._log?.warn(this._scope, 'warmup failed', err);
        }
    }
    async _autobeeApply(nodes, view, host) {
        const tx = view.db.transaction();
        try {
            for (const node of nodes) {
                if (!node.value)
                    continue;
                await this._applyNode(node, { tx, host });
            }
            await tx.flush();
        }
        catch (err) {
            await tx.close();
            if (isInterrupt(err)) {
                throw err;
            }
            if (isFromANewerBuild(err)) {
                this._halt(err, host);
            }
            this._log?.error(this._scope, 'autobee apply', err);
            throw err;
        }
    }
    async _applyNode(node, { tx, host }) {
        try {
            await this.router.dispatch(node.value, {
                tx,
                host,
                node,
                meshPublicKey: this.publicKey,
                meshDevicePublicKey: this.devicePublicKey,
                log: this._log
            });
        }
        catch (err) {
            if (!isFromANewerBuild(err)) {
                throw err;
            }
            this._halt(err, host);
        }
    }
    _halt(err, host) {
        this._log?.warn(this._scope, 'halting apply: the mesh moved past this build', err);
        return host.interrupt(err);
    }
    async _autobeeUpdate(_view, changes) {
        const change = changes.get('view');
        if (this.closing || !change) {
            return;
        }
        const shared = change.shared;
        const from = shared?.key ? { key: shared.key, length: shared.length } : change.from;
        await this._updates.push({
            from,
            to: change.to?.length ?? 0,
            incremental: !!from?.length && isIncremental(change)
        });
    }
    synced() {
        return this._updates.flush();
    }
    async _syncUpdate({ from, to, incremental }) {
        if (this.closing)
            return null;
        const started = Date.now();
        let reached = null;
        try {
            if (from && incremental) {
                reached = await syncChanges(this, this.autobee.view, from);
            }
            else {
                this._arrive();
            }
            if (this._admitted && !this.autobee.writable) {
                await this.checkOwnAdmission();
            }
        }
        catch (err) {
            if (!this.closing) {
                this._log?.warn(this._scope, 'change sync failed', err);
            }
        }
        this._log?.debug(this._scope, 'view synced', {
            from: from?.length ?? 0,
            to: reached?.length ?? to,
            ms: Date.now() - started
        });
        return reached;
    }
    _arrive() {
        this._log?.info(this._scope, 'landed on the view', {
            fastForwards: this.autobee.stats.fastForwards,
            ...this._lengths(),
            sinceOpenMs: this._sinceOpen()
        });
        this.emit('landed');
        this.emit('indexing-dirty');
        this.emit('agents-dirty');
        this.emit('skill-secrets-dirty');
        this.emit('meshes-dirty', true);
        void this._readLanding().catch((err) => {
            if (!this.closing) {
                this._log?.warn(this._scope, 'reading the landed view failed', err);
            }
        });
    }
    async _readLanding() {
        const started = Date.now();
        const [own] = await Promise.all([
            this.refreshOurMember(),
            this.refreshMembership(),
            this.refreshName()
        ]);
        if (this.closing) {
            return;
        }
        if (own && isOwnKickedRow(this, own)) {
            this.emit('kicked');
        }
        if (this._membership.unattested > 0) {
            this.emit('unattested-device');
        }
        this.emit('membership-tallied');
        this.emit('members-dirty');
        this.emit('mesh-named');
        this._log?.debug(this._scope, 'read the landed view', { ms: Date.now() - started });
    }
    async checkOwnAdmission() {
        if (this.autobee.writable) {
            this._admitted = true;
            return;
        }
        if (!this._admitted || !this._deviceId) {
            return;
        }
        if (!(await this.autobee.system.get(this.localWriterKey, { unflushed: true }))) {
            return;
        }
        const own = await this.view.get(DEVICES, { id: this._deviceId });
        if (own?.writerKey && b4a.equals(own?.writerKey, this.localWriterKey)) {
            return;
        }
        this._admitted = false;
        this.emit('kicked');
    }
    async checkResumedRevocation() {
        const snap = this.view.snapshot();
        try {
            for await (const device of snap.find(DEVICES)) {
                if (!isOwnRevokedRow(this, device))
                    continue;
                return isOwnKickedRow(this, device) ? 'kicked' : 'left';
            }
            return null;
        }
        finally {
            await snap.close();
        }
    }
    async ownWriterRefused() {
        const info = await this.autobee.system.get(this.localWriterKey, { unflushed: true });
        if (!info?.isRemoved) {
            return false;
        }
        for await (const device of this.view.find(DEVICES)) {
            if (device.writerKey && b4a.equals(device.writerKey, this.localWriterKey)) {
                return false;
            }
        }
        return true;
    }
}
export class MeshBatch {
    _autobee;
    _role;
    _joined;
    _watch;
    _ops = [];
    _names = [];
    constructor(autobee, opts = {}) {
        this._autobee = autobee;
        this._role = opts.role ?? 'account';
        this._joined = opts.joined ?? false;
        this._watch = opts.watch ?? ((_op, write) => write);
    }
    get size() {
        return this._ops.length;
    }
    dispatch(name, payload) {
        assertRoleRoute(this._role, name);
        this._ops.push(encode(`@qvac/${name}`, versionedOp(name, payload)));
        this._names.push(name);
    }
    async flush(opts) {
        if (this._ops.length === 0)
            return;
        if (this._joined) {
            assertJoined(this._autobee, opts);
        }
        const ops = this._ops;
        const names = this._names;
        this._ops = [];
        this._names = [];
        await this._watch(names.join(','), this._autobee.append(ops, opts));
    }
}
function noop() { }
function viewCoreOf(head) {
    return isRecord(head) && b4a.isBuffer(head.key) ? b4a.toHex(head.key).slice(0, 8) : null;
}
function isIncremental(change) {
    return isRecord(change) && change.incremental === true;
}
function assertJoined(autobee, opts) {
    if (!opts?.optimistic && !autobee.writable) {
        throw new CoreError('MESH_STILL_JOINING');
    }
}
function openedPart(part, name) {
    if (part === null)
        throw new Error(`mesh ${name} read before open`);
    return part;
}
async function drain(stream) {
    let count = 0;
    for await (const _row of stream) {
        count++;
    }
    return count;
}
const NEWER_BUILD_MESSAGES = new Set(['Unsupported version', 'Unknown enum', 'Out of bounds']);
function isInterrupt(err) {
    return err instanceof Error && err.message === 'Apply interrupted';
}
function isFromANewerBuild(err) {
    if (isCoreError(err, 'MESH_RULES_FROM_A_NEWER_BUILD')) {
        return true;
    }
    if (isRecord(err) && 'code' in err) {
        return err.code === ERRORS.HANDLER_NOT_FOUND_BY_ID;
    }
    return err instanceof Error && NEWER_BUILD_MESSAGES.has(err.message);
}
