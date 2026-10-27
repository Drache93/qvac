import CorestoreStorage from 'hypercore-storage';
import HyperDB from 'hyperdb';
import crypto from 'hypercore-crypto';
import ScopeLock from 'scope-lock';
import { MAX_DEVICE_NAME_CHARS, deviceNameWithinBounds } from '../../../schema/qvac.js';
import { generateMnemonic, mintIdentity } from '../identity.js';
import { CoreError } from '../../errors.js';
import LocalDatabaseSpec from '../../../spec/local/hyperdb/index.js';
import b4a from 'b4a';
import { dropMeshFileCursors, LocalFiles } from './files.js';
import { LocalRunLogs } from './run-logs.js';
import { LOCAL_ACCOUNT_RECOVERY, LOCAL_ACTIVE_MESH, LOCAL_APP_CONFIG, LOCAL_CHAT_MOVES, LOCAL_MESH_UPDATES, LOCAL_MESH_PURGES, LOCAL_MESH_NAMES, LOCAL_CHAT_NOTIFY, LOCAL_CHAT_ORDER, LOCAL_CHAT_ORDER_BY_KEY, LOCAL_CONFIG, LOCAL_CUSTOM_MODEL, LOCAL_FILES, LOCAL_DEVICE, LOCAL_IDENTITY, LOCAL_MEMBERSHIP, LOCAL_MEMBER_PROOF, LOCAL_MESH_DEPARTURE, LOCAL_MESH_HISTORY, LOCAL_MESH_MEMBERSHIP, LOCAL_MESH_SESSION, LOCAL_MODEL_DOWNLOAD, LOCAL_MODEL_NOTIFY, LOCAL_RUN_LOGS, LOCAL_RUN_LOG_STEPS } from '../collections.js';
export const MESH_LOCAL_COLLECTIONS = [
    { collection: LOCAL_MESH_MEMBERSHIP, field: 'key' },
    { collection: LOCAL_MESH_DEPARTURE, field: 'key' },
    { collection: LOCAL_MESH_PURGES, field: 'key' },
    { collection: LOCAL_MEMBER_PROOF, field: 'meshKey' },
    { collection: LOCAL_ACCOUNT_RECOVERY, field: 'meshKey' },
    { collection: LOCAL_CHAT_ORDER, field: 'meshKey' },
    { collection: LOCAL_FILES, field: 'meshKey' },
    { collection: LOCAL_MESH_UPDATES, field: 'meshKey' },
    { collection: LOCAL_MESH_NAMES, field: 'meshKey' },
    { collection: LOCAL_RUN_LOGS, field: 'meshKey' },
    { collection: LOCAL_RUN_LOG_STEPS, field: 'meshKey' }
];
export const MESH_CONFIG_FAMILIES = ['workspace-upgrade', 'workspace-agents'];
const IDENTITY_ID = 'identity';
const MEMBERSHIP_ID = 'membership';
const APP_CONFIG_ID = 'default';
function freshWriterSeed() {
    return `local-${b4a.toHex(crypto.randomBytes(8))}`;
}
function sessionOf(row) {
    return {
        seed: row.seed,
        baseKey: row.key ?? undefined,
        writerSeed: row.writerSeed ?? undefined,
        role: meshRole(row.role),
        workspaceKey: row.workspaceKey ?? undefined
    };
}
function meshRole(role) {
    return role === 'account' || role === 'workspace' || role === 'project' ? role : undefined;
}
export function recordedRole(row) {
    return meshRole(row.role) ?? (row.wasHome ? 'account' : 'project');
}
export function openLocalStore(storage) {
    const db = HyperDB.rocks(storage.rocks.columnFamily('assistant/local'), LocalDatabaseSpec);
    return new LocalStore(db);
}
class LocalStore {
    _db;
    _writeLock = new ScopeLock();
    files;
    runLogs;
    constructor(db) {
        this._db = db;
        this.files = new LocalFiles(db, (fn) => this._locked(fn));
        this.runLogs = new LocalRunLogs(db, (fn) => this._locked(fn));
    }
    async _locked(fn) {
        await this._writeLock.lock();
        try {
            return await fn();
        }
        finally {
            this._writeLock.unlock();
        }
    }
    async get(key) {
        const row = await this._db.get(LOCAL_CONFIG, { key });
        return row === null ? null : row.value;
    }
    set(key, value) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_CONFIG, { key, value });
            await tx.flush();
        });
    }
    setAll(entries) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            for (const { key, value } of entries) {
                await tx.insert(LOCAL_CONFIG, { key, value });
            }
            await tx.flush();
        });
    }
    rekey(fromKey, toKey) {
        return this._locked(async () => {
            const row = await this._db.get(LOCAL_CONFIG, { key: fromKey });
            if (!row) {
                return null;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_CONFIG, { key: toKey, value: row.value });
            await tx.delete(LOCAL_CONFIG, { key: fromKey });
            await tx.flush();
            return row.value;
        });
    }
    deleteAll(keys) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            for (const key of keys) {
                await tx.delete(LOCAL_CONFIG, { key });
            }
            await tx.flush();
        });
    }
    deletePrefix(prefix) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const range = { gte: { key: prefix }, lt: { key: `${prefix}\uffff` } };
            for await (const row of this._db.find(LOCAL_CONFIG, range)) {
                await tx.delete(LOCAL_CONFIG, { key: row.key });
            }
            await tx.flush();
        });
    }
    async listPrefix(prefix) {
        const range = { gte: { key: prefix }, lt: { key: `${prefix}\uffff` } };
        const rows = await this._db.find(LOCAL_CONFIG, range).toArray();
        return rows.map(({ key, value }) => ({ key, value }));
    }
    getAppConfigRow() {
        return this._db.get(LOCAL_APP_CONFIG, { id: APP_CONFIG_ID });
    }
    updateAppConfigRow(mutate) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const current = await tx.get(LOCAL_APP_CONFIG, { id: APP_CONFIG_ID });
            const next = { id: APP_CONFIG_ID, ...mutate(current) };
            await tx.insert(LOCAL_APP_CONFIG, next);
            await tx.flush();
            return next;
        });
    }
    getChatNotify(chatId) {
        return this._locked(() => this._db.get(LOCAL_CHAT_NOTIFY, { chatId }));
    }
    ackChatNotify(chatId, seq) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const current = await tx.get(LOCAL_CHAT_NOTIFY, { chatId });
            const ackedThrough = Math.max(current?.ackedThrough ?? 0, seq + 1);
            await tx.insert(LOCAL_CHAT_NOTIFY, { chatId, ackedThrough });
            await tx.flush();
        });
    }
    clearChatNotify(chatId) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.delete(LOCAL_CHAT_NOTIFY, { chatId });
            await tx.flush();
        });
    }
    writeChatOrder(meshKey, rows, gone = []) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            for (const row of rows) {
                await tx.insert(LOCAL_CHAT_ORDER, { meshKey, ...row });
            }
            for (const chatId of gone) {
                await tx.delete(LOCAL_CHAT_ORDER, { meshKey, chatId });
            }
            await tx.flush();
        });
    }
    listChatOrder(meshKey, { limit, before } = {}) {
        return this._db
            .find(LOCAL_CHAT_ORDER_BY_KEY, {
            gte: { meshKey },
            lt: before === undefined ? undefined : { meshKey, ...before },
            lte: before === undefined ? { meshKey } : undefined,
            reverse: true,
            limit
        })
            .toArray();
    }
    async _dropChatOrder(tx, meshKey) {
        for (const order of await this._chatOrderIn(tx, meshKey)) {
            await tx.delete(LOCAL_CHAT_ORDER, { meshKey, chatId: order.chatId });
        }
    }
    _chatOrderIn(db, meshKey) {
        return db
            .find(LOCAL_CHAT_ORDER_BY_KEY, {
            gte: { meshKey },
            lte: { meshKey }
        })
            .toArray();
    }
    beginModelTransfer(name, { transferred = false } = {}) {
        return this._locked(async () => {
            const current = await this._db.get(LOCAL_MODEL_NOTIFY, { name });
            const pending = current && current.transferId !== current.notificationId;
            if (pending && (!transferred || current.transferred)) {
                return current;
            }
            const next = {
                name,
                transferId: pending ? current.transferId : b4a.toHex(crypto.randomBytes(16)),
                notificationId: current?.notificationId,
                completedAt: current?.completedAt,
                acknowledged: current?.acknowledged,
                transferred
            };
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MODEL_NOTIFY, next);
            await tx.flush();
            return next;
        });
    }
    completeModelTransfer({ name, transferId, downloaded = true }) {
        return this._locked(async () => {
            const current = await this._db.get(LOCAL_MODEL_NOTIFY, { name });
            if (!current || current.transferId !== transferId || current.notificationId === transferId) {
                return;
            }
            if (!downloaded && !current.transferred) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MODEL_NOTIFY, {
                name,
                transferId,
                notificationId: transferId,
                completedAt: Date.now(),
                acknowledged: false,
                transferred: true
            });
            await tx.flush();
        });
    }
    getModelNotifications() {
        return this._locked(() => this._db.find(LOCAL_MODEL_NOTIFY).toArray());
    }
    ackModelNotification(notificationId) {
        return this._locked(async () => {
            const rows = await this._db.find(LOCAL_MODEL_NOTIFY).toArray();
            const current = rows.find((row) => row.notificationId === notificationId);
            if (!current || current.acknowledged) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MODEL_NOTIFY, {
                name: current.name,
                transferId: current.transferId,
                notificationId: current.notificationId,
                completedAt: current.completedAt,
                transferred: current.transferred,
                acknowledged: true
            });
            await tx.flush();
        });
    }
    async getModelDownloadRows() {
        const rows = [];
        for await (const row of this._db.find(LOCAL_MODEL_DOWNLOAD)) {
            rows.push(row);
        }
        return rows;
    }
    putModelDownloadRow(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MODEL_DOWNLOAD, row);
            await tx.flush();
        });
    }
    deleteModelDownloadRow(name) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.delete(LOCAL_MODEL_DOWNLOAD, { name });
            await tx.flush();
        });
    }
    async getCustomModelRows() {
        const rows = [];
        for await (const row of this._db.find(LOCAL_CUSTOM_MODEL)) {
            rows.push(row);
        }
        return rows;
    }
    putCustomModelRow(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_CUSTOM_MODEL, row);
            await tx.flush();
        });
    }
    deleteCustomModelRow(name) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.delete(LOCAL_CUSTOM_MODEL, { name });
            await tx.flush();
        });
    }
    ensureDevice(publicKey, seed) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_DEVICE, { publicKey });
            if (existing) {
                return {
                    name: existing.name,
                    capabilityProfile: existing.capabilityProfile,
                    recommendedModelName: existing.recommendedModelName,
                    platform: existing.platform ?? undefined
                };
            }
            if (!seed) {
                return null;
            }
            const name = seed.name.trim();
            if (!deviceNameWithinBounds(name)) {
                throw new CoreError('DEVICE_NAME_TOO_LONG', [MAX_DEVICE_NAME_CHARS]);
            }
            seed = { ...seed, name };
            const tx = this._db.transaction();
            await tx.insert(LOCAL_DEVICE, { publicKey, ...seed });
            await tx.flush();
            return seed;
        });
    }
    renameDevice(publicKey, name) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_DEVICE, { publicKey });
            if (!existing) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_DEVICE, { ...existing, name });
            await tx.flush();
        });
    }
    saveDeviceProfile(publicKey, { capabilityProfile, recommendedModelName, platform }) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_DEVICE, { publicKey });
            if (!existing) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_DEVICE, {
                ...existing,
                capabilityProfile,
                recommendedModelName,
                platform: platform ?? existing.platform
            });
            await tx.flush();
        });
    }
    readIdentity() {
        return this._db.get(LOCAL_IDENTITY, { id: IDENTITY_ID });
    }
    saveDisplayName(displayName, displayNameAt = Date.now()) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const existing = await tx.get(LOCAL_IDENTITY, { id: IDENTITY_ID });
            if (!existing) {
                await tx.close();
                return null;
            }
            const identity = { ...existing, displayName, displayNameAt };
            await tx.insert(LOCAL_IDENTITY, identity);
            await tx.flush();
            return identity;
        });
    }
    readMemberProof(meshKey) {
        return this._db.get(LOCAL_MEMBER_PROOF, { meshKey });
    }
    recordMemberProof(link) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MEMBER_PROOF, {
                meshKey: link.meshKey
            });
            if (existing && existing.attestedAt >= link.attestedAt) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MEMBER_PROOF, link);
            await tx.flush();
        });
    }
    readAccountRecovery(meshKey) {
        return this._db.get(LOCAL_ACCOUNT_RECOVERY, { meshKey });
    }
    readChatMove(meshKey, chatId) {
        return this._db.get(LOCAL_CHAT_MOVES, { meshKey, chatId });
    }
    listChatMoves() {
        return this._db.find(LOCAL_CHAT_MOVES).toArray();
    }
    readMeshUpdate(meshKey) {
        return this._db.get(LOCAL_MESH_UPDATES, { meshKey });
    }
    writeMeshUpdate(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_UPDATES, row);
            await tx.flush();
        });
    }
    clearMeshUpdate(meshKey) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.delete(LOCAL_MESH_UPDATES, { meshKey });
            await tx.flush();
        });
    }
    meshNames() {
        return this._db.find(LOCAL_MESH_NAMES).toArray();
    }
    keepMeshName(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_NAMES, row);
            await tx.flush();
        });
    }
    recordChatMove(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_CHAT_MOVES, row);
            await tx.flush();
        });
    }
    recordAccountRecovery(row) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_ACCOUNT_RECOVERY, row);
            await tx.flush();
        });
    }
    replaceIdentity(identity) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const existing = await tx.get(LOCAL_IDENTITY, { id: IDENTITY_ID });
            await tx.insert(LOCAL_IDENTITY, {
                id: IDENTITY_ID,
                displayName: existing?.displayName ?? null,
                displayNameAt: existing?.displayNameAt,
                ...identity
            });
            await tx.flush();
        });
    }
    ensureIdentity(devicePublicKey, createdAt) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_IDENTITY, { id: IDENTITY_ID });
            if (existing) {
                return { identity: existing, mnemonic: null };
            }
            const mnemonic = await generateMnemonic();
            const minted = await mintIdentity(mnemonic, devicePublicKey);
            const identity = {
                id: IDENTITY_ID,
                publicKey: minted.publicKey,
                proof: minted.proof,
                createdAt
            };
            const tx = this._db.transaction();
            await tx.insert(LOCAL_IDENTITY, identity);
            await tx.flush();
            return { identity, mnemonic };
        });
    }
    async resolveSession(deviceId, opts = {}) {
        const current = await this._activeMembership(deviceId);
        const named = opts.baseKey ? await this._membership(opts.baseKey) : null;
        const resumed = [current, named].find((row) => row && !!opts.seed && b4a.equals(opts.seed, row.seed)) ?? null;
        if (opts.seed && !resumed) {
            return {
                seed: opts.seed,
                baseKey: opts.baseKey,
                writerSeed: opts.writerSeed ?? freshWriterSeed(),
                role: opts.role,
                workspaceKey: opts.workspaceKey
            };
        }
        const session = resumed ?? current;
        if (session && !opts.new) {
            return sessionOf(session);
        }
        return {
            seed: crypto.randomBytes(32),
            baseKey: undefined,
            writerSeed: undefined,
            role: opts.role,
            workspaceKey: opts.workspaceKey
        };
    }
    createCandidateSession(seed, baseKey, { role, workspaceKey } = {}) {
        return {
            seed,
            baseKey,
            writerSeed: freshWriterSeed(),
            role,
            workspaceKey
        };
    }
    async _activeMembership(deviceId) {
        const pointer = await this._db.get(LOCAL_ACTIVE_MESH, { deviceId });
        if (!pointer) {
            return this._migrateLegacySession(deviceId);
        }
        return this._membership(pointer.homeMeshKey);
    }
    async _membership(key) {
        if (!key)
            return null;
        const row = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
        return row && !row.leftAt ? row : null;
    }
    _migrateLegacySession(deviceId) {
        return this._locked(async () => {
            const legacy = await this._legacyMembership(deviceId);
            if (!legacy) {
                return null;
            }
            const key = legacy.key;
            if (!key) {
                return legacy;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_MEMBERSHIP, { ...legacy, key });
            await tx.insert(LOCAL_ACTIVE_MESH, { deviceId, homeMeshKey: key });
            const shipped = await tx.get(LOCAL_MEMBERSHIP, { id: MEMBERSHIP_ID });
            if (shipped) {
                const { memberId, proof, attestedAt } = shipped;
                await tx.insert(LOCAL_MEMBER_PROOF, {
                    meshKey: key,
                    memberId,
                    proof,
                    attestedAt
                });
            }
            await tx.flush();
            return legacy;
        });
    }
    async _legacyMembership(deviceId) {
        const history = await this._db.findOne(LOCAL_MESH_HISTORY);
        if (history) {
            return { key: history.key, seed: history.seed, writerSeed: history.writerSeed };
        }
        const session = await this._db.get(LOCAL_MESH_SESSION, { deviceId });
        if (!session?.meshSeed) {
            return null;
        }
        return { key: session.meshKey ?? null, seed: session.meshSeed, writerSeed: null };
    }
    recordMesh(key, session, { deviceId, account = false }) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            const minted = account && !existing && session.baseKey === undefined;
            const tx = this._db.transaction();
            await tx.delete(LOCAL_MESH_PURGES, { key });
            await tx.insert(LOCAL_MESH_MEMBERSHIP, {
                key,
                seed: session.seed,
                writerSeed: session.writerSeed,
                awaitingAdmission: existing?.awaitingAdmission,
                role: session.role ?? existing?.role,
                workspaceKey: session.workspaceKey ?? existing?.workspaceKey
            });
            if (minted) {
                await tx.insert(LOCAL_ACTIVE_MESH, { deviceId, homeMeshKey: key });
            }
            await tx.flush();
        });
    }
    setAccountMesh(deviceId, key) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_ACTIVE_MESH, { deviceId, homeMeshKey: key });
            await tx.flush();
        });
    }
    recordDeparture(key, opts) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const row = await tx.get(LOCAL_MESH_MEMBERSHIP, { key });
            if (!row) {
                await tx.close();
                return;
            }
            const { home } = await this._pointersAt(key);
            await tx.insert(LOCAL_MESH_DEPARTURE, {
                key: row.key,
                seed: row.seed,
                creator: opts.creator,
                writerSeed: row.writerSeed,
                role: recordedRole({ role: row.role, wasHome: home })
            });
            await tx.flush();
        });
    }
    async departures() {
        const rows = [];
        for await (const row of this._db.find(LOCAL_MESH_DEPARTURE)) {
            rows.push(row);
        }
        return rows;
    }
    async departureRole(departure) {
        const row = await this._db.get(LOCAL_MESH_MEMBERSHIP, {
            key: departure.key
        });
        return meshRole(departure.role) ?? recordedRole({ role: row?.role, wasHome: row?.wasHome });
    }
    deleteDeparture(key) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.delete(LOCAL_MESH_DEPARTURE, { key });
            await tx.flush();
        });
    }
    archiveMesh(key) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            const { cleared, home } = await this._pointersAt(key);
            const tx = this._db.transaction();
            if (existing) {
                await tx.insert(LOCAL_MESH_MEMBERSHIP, {
                    ...existing,
                    leftAt: Date.now(),
                    wasHome: home
                });
            }
            for (const pointer of cleared) {
                await tx.insert(LOCAL_ACTIVE_MESH, pointer);
            }
            await this._dropChatOrder(tx, key);
            await this._dropRows(tx, key, { collection: LOCAL_FILES, field: 'meshKey' });
            await dropMeshFileCursors(tx, key);
            await tx.delete(LOCAL_MESH_UPDATES, { meshKey: key });
            await tx.flush();
        });
    }
    readPurge(key) {
        return this._db.get(LOCAL_MESH_PURGES, { key });
    }
    pendingPurges() {
        return this._db.find(LOCAL_MESH_PURGES).toArray();
    }
    dropMesh(key, opts = {}) {
        return this._locked(async () => {
            const held = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            const purging = await this._db.get(LOCAL_MESH_PURGES, { key });
            const tx = this._db.transaction();
            await this._dropMeshRows(tx, key, opts);
            await tx.flush();
            return !!held || !!purging;
        });
    }
    dropLeftMeshes() {
        return this._locked(async () => {
            const tx = this._db.transaction();
            for await (const row of this._db.find(LOCAL_MESH_MEMBERSHIP)) {
                const departing = await this._db.get(LOCAL_MESH_DEPARTURE, { key: row.key });
                if (row.leftAt && !row.wasHome && !departing) {
                    await this._dropMeshRows(tx, row.key);
                }
            }
            await tx.flush();
        });
    }
    async _dropMeshRows(tx, key, { keepDeparture = false, cores } = {}) {
        for (const order of await this._chatOrderIn(tx, key)) {
            await tx.delete(LOCAL_CHAT_NOTIFY, { chatId: order.chatId });
        }
        for (const { collection, field } of MESH_LOCAL_COLLECTIONS) {
            if (!(keepDeparture && collection === LOCAL_MESH_DEPARTURE)) {
                await this._dropRows(tx, key, { collection, field });
            }
        }
        const { cleared } = await this._pointersAt(key);
        for (const pointer of cleared) {
            await tx.insert(LOCAL_ACTIVE_MESH, pointer);
        }
        await dropMeshFileCursors(tx, key);
        await this._dropMeshConfig(tx, key);
        await this._dropSettledMoves(tx, key);
        if (cores) {
            await tx.insert(LOCAL_MESH_PURGES, { key, cores: [...cores] });
        }
    }
    async _dropSettledMoves(tx, key) {
        const range = { gte: { meshKey: key }, lte: { meshKey: key } };
        for (const row of await tx.find(LOCAL_CHAT_MOVES, range).toArray()) {
            if (row.completedAt || row.failure) {
                await tx.delete(LOCAL_CHAT_MOVES, { meshKey: row.meshKey, chatId: row.chatId });
            }
        }
    }
    async _dropMeshConfig(tx, key) {
        for (const family of MESH_CONFIG_FAMILIES) {
            const prefix = `${family}/${b4a.toHex(key)}`;
            await tx.delete(LOCAL_CONFIG, { key: prefix });
            const range = { gt: { key: `${prefix}/` }, lt: { key: `${prefix}/\uffff` } };
            for (const row of await tx.find(LOCAL_CONFIG, range).toArray()) {
                await tx.delete(LOCAL_CONFIG, { key: row.key });
            }
        }
    }
    async _dropRows(tx, key, { collection, field }) {
        const range = { gte: { [field]: key }, lte: { [field]: key } };
        for (const row of await tx.find(collection, range).toArray()) {
            await tx.delete(collection, row);
        }
    }
    markAwaitingAdmission(key, opts) {
        const { awaitingAdmission } = opts;
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            if (!existing || !!existing.awaitingAdmission === awaitingAdmission) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_MEMBERSHIP, {
                ...existing,
                awaitingAdmission
            });
            await tx.flush();
        });
    }
    setMeshRole(key, role) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            if (!existing || existing.role === role) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_MEMBERSHIP, { ...existing, role });
            await tx.flush();
        });
    }
    async awaitsAdmission(key) {
        return !!(await this._membership(key))?.awaitingAdmission;
    }
    markMeshMigrated(key, migratedAt) {
        return this._locked(async () => {
            const existing = await this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
            if (!existing) {
                return;
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_MESH_MEMBERSHIP, { ...existing, migratedAt });
            await tx.flush();
        });
    }
    adoptAccountMesh(deviceId, key, { account, keepName }) {
        return this._locked(async () => {
            const departed = [];
            for await (const row of this._db.find(LOCAL_MESH_MEMBERSHIP)) {
                if (!b4a.equals(row.key, key) && !row.leftAt) {
                    departed.push(row);
                }
            }
            const leftAt = Date.now();
            const tx = this._db.transaction();
            for (const row of departed) {
                if (!account || !b4a.equals(account, row.key)) {
                    await this._dropMeshRows(tx, row.key, { keepDeparture: true });
                    continue;
                }
                await tx.insert(LOCAL_MESH_MEMBERSHIP, {
                    ...row,
                    leftAt,
                    wasHome: true
                });
                await this._dropChatOrder(tx, row.key);
                await this._dropRows(tx, row.key, { collection: LOCAL_FILES, field: 'meshKey' });
                await dropMeshFileCursors(tx, row.key);
                await tx.delete(LOCAL_MESH_UPDATES, { meshKey: row.key });
            }
            const identity = await tx.get(LOCAL_IDENTITY, { id: IDENTITY_ID });
            if (!keepName && identity?.displayName) {
                await tx.insert(LOCAL_IDENTITY, {
                    ...identity,
                    displayName: null,
                    displayNameAt: 0
                });
            }
            await tx.insert(LOCAL_ACTIVE_MESH, { deviceId, homeMeshKey: key });
            await tx.flush();
        });
    }
    async _pointersAt(key) {
        const cleared = [];
        let home = false;
        for await (const pointer of this._db.find(LOCAL_ACTIVE_MESH)) {
            if (!pointer.homeMeshKey || !b4a.equals(pointer.homeMeshKey, key)) {
                continue;
            }
            home = true;
            cleared.push({ deviceId: pointer.deviceId, homeMeshKey: null });
        }
        return { cleared, home };
    }
    async listMeshes() {
        const rows = [];
        for await (const row of this._db.find(LOCAL_MESH_MEMBERSHIP)) {
            if (!row.leftAt) {
                rows.push(row);
            }
        }
        return rows;
    }
    async listArchivedMeshes() {
        const rows = [];
        for await (const row of this._db.find(LOCAL_MESH_MEMBERSHIP)) {
            const { leftAt } = row;
            if (leftAt) {
                rows.push({ ...row, leftAt });
            }
        }
        return rows;
    }
    async accountMesh(deviceId) {
        const pointer = await this._db.get(LOCAL_ACTIVE_MESH, { deviceId });
        return this._membership(pointer?.homeMeshKey);
    }
    meshRecord(key) {
        return this._db.get(LOCAL_MESH_MEMBERSHIP, { key });
    }
    async readMeshSession(key) {
        const row = await this._membership(key);
        return row ? sessionOf(row) : null;
    }
    watch(listener) {
        this._db.watch(listener);
    }
    unwatch(listener) {
        this._db.unwatch(listener);
    }
    async close() {
        await this._locked(() => this._db.close());
    }
}
