import CorestoreStorage from 'hypercore-storage';
import HyperDB from 'hyperdb';
import type { LocalAccountRecovery, LocalAppConfig, LocalCapabilityProfile, LocalChatMove, LocalMeshUpdate, LocalMeshName, LocalChatNotify, LocalChatOrder, LocalCustomModel, LocalIdentity, LocalMemberProof, LocalMeshDeparture, LocalMeshMembership, LocalMeshPurge, LocalModelDownload, LocalModelNotify } from '../../../spec/local/hyperschema/types.d.ts';
import type { DeviceMetadata } from '../mesh.ts';
import type { MeshRole } from '../contract/roles.ts';
import { LocalFiles } from './files.ts';
import { LocalRunLogs } from './run-logs.ts';
export declare const MESH_LOCAL_COLLECTIONS: readonly [{
    readonly collection: "@local/mesh-membership";
    readonly field: 'key';
}, {
    readonly collection: "@local/mesh-departure";
    readonly field: 'key';
}, {
    readonly collection: "@local/mesh-purges";
    readonly field: 'key';
}, {
    readonly collection: "@local/member-proof";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/account-recovery";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/chat-order";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/files";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/mesh-updates";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/mesh-names";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/run-logs";
    readonly field: 'meshKey';
}, {
    readonly collection: "@local/run-log-steps";
    readonly field: 'meshKey';
}];
export declare const MESH_CONFIG_FAMILIES: readonly ['workspace-upgrade', 'workspace-agents'];
export interface ResolvedSession {
    readonly seed: Buffer;
    readonly baseKey: Buffer | undefined;
    readonly writerSeed: string | undefined;
    readonly role?: MeshRole;
    readonly workspaceKey?: Buffer;
}
export interface ArchivedMeshMembership extends LocalMeshMembership {
    readonly leftAt: number;
}
export interface ConfigEntry {
    readonly key: string;
    readonly value: unknown;
}
export interface ChatOrderEntry {
    readonly chatId: string;
    readonly sortKey: Buffer;
}
export interface ChatOrderCursor {
    readonly sortKey: Uint8Array;
    readonly chatId: string;
}
export interface ListChatOrderOptions {
    readonly limit?: number;
    readonly before?: ChatOrderCursor;
}
export interface BeginModelTransferOptions {
    readonly transferred?: boolean;
}
export interface CompleteModelTransferOptions {
    readonly name: string;
    readonly transferId: string;
    readonly downloaded?: boolean;
}
export interface DeviceProfile {
    readonly capabilityProfile: LocalCapabilityProfile;
    readonly recommendedModelName: string;
    readonly platform?: string;
}
export interface EnsuredIdentity {
    readonly identity: LocalIdentity;
    readonly mnemonic: string | null;
}
export interface ResolveSessionOptions {
    readonly seed?: Buffer;
    readonly baseKey?: Buffer;
    readonly new?: boolean;
    readonly writerSeed?: string;
    readonly role?: MeshRole;
    readonly workspaceKey?: Buffer;
}
export interface CandidateSessionOptions {
    readonly role?: MeshRole;
    readonly workspaceKey?: Buffer;
}
export interface RecordMeshOptions {
    readonly deviceId: Buffer;
    readonly account?: boolean;
}
export interface DropMeshOptions {
    readonly keepDeparture?: boolean;
    readonly cores?: ReadonlyArray<Buffer>;
}
export interface RecordDepartureOptions {
    readonly creator: boolean;
}
export interface AdoptAccountMeshOptions {
    readonly account?: Buffer | null;
    readonly keepName?: boolean;
}
export interface MarkAwaitingAdmissionOptions {
    readonly awaitingAdmission: boolean;
}
export declare function recordedRole(row: Pick<LocalMeshMembership, 'role' | 'wasHome'>): MeshRole;
export declare function openLocalStore(storage: CorestoreStorage): LocalStore;
declare class LocalStore {
    private readonly _db;
    private readonly _writeLock;
    readonly files: LocalFiles;
    readonly runLogs: LocalRunLogs;
    constructor(db: HyperDB);
    private _locked;
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    setAll(entries: ReadonlyArray<ConfigEntry>): Promise<void>;
    rekey(fromKey: string, toKey: string): Promise<unknown>;
    deleteAll(keys: ReadonlyArray<string>): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
    listPrefix(prefix: string): Promise<ConfigEntry[]>;
    getAppConfigRow(): Promise<LocalAppConfig | null>;
    updateAppConfigRow(mutate: (current: LocalAppConfig | null) => Omit<LocalAppConfig, 'id'>): Promise<LocalAppConfig>;
    getChatNotify(chatId: string): Promise<LocalChatNotify | null>;
    ackChatNotify(chatId: string, seq: number): Promise<void>;
    clearChatNotify(chatId: string): Promise<void>;
    writeChatOrder(meshKey: Buffer, rows: ReadonlyArray<ChatOrderEntry>, gone?: ReadonlyArray<string>): Promise<void>;
    listChatOrder(meshKey: Buffer, { limit, before }?: ListChatOrderOptions): Promise<LocalChatOrder[]>;
    private _dropChatOrder;
    private _chatOrderIn;
    beginModelTransfer(name: string, { transferred }?: BeginModelTransferOptions): Promise<LocalModelNotify>;
    completeModelTransfer({ name, transferId, downloaded }: CompleteModelTransferOptions): Promise<void>;
    getModelNotifications(): Promise<LocalModelNotify[]>;
    ackModelNotification(notificationId: string): Promise<void>;
    getModelDownloadRows(): Promise<LocalModelDownload[]>;
    putModelDownloadRow(row: LocalModelDownload): Promise<void>;
    deleteModelDownloadRow(name: string): Promise<void>;
    getCustomModelRows(): Promise<LocalCustomModel[]>;
    putCustomModelRow(row: LocalCustomModel): Promise<void>;
    deleteCustomModelRow(name: string): Promise<void>;
    ensureDevice(publicKey: Buffer, seed?: DeviceMetadata): Promise<DeviceMetadata | null>;
    renameDevice(publicKey: Buffer, name: string): Promise<void>;
    saveDeviceProfile(publicKey: Buffer, { capabilityProfile, recommendedModelName, platform }: DeviceProfile): Promise<void>;
    readIdentity(): Promise<LocalIdentity | null>;
    saveDisplayName(displayName: string, displayNameAt?: number): Promise<LocalIdentity | null>;
    readMemberProof(meshKey: Buffer): Promise<LocalMemberProof | null>;
    recordMemberProof(link: LocalMemberProof): Promise<void>;
    readAccountRecovery(meshKey: Buffer): Promise<LocalAccountRecovery | null>;
    readChatMove(meshKey: Buffer, chatId: string): Promise<LocalChatMove | null>;
    listChatMoves(): Promise<LocalChatMove[]>;
    readMeshUpdate(meshKey: Buffer): Promise<LocalMeshUpdate | null>;
    writeMeshUpdate(row: LocalMeshUpdate): Promise<void>;
    clearMeshUpdate(meshKey: Buffer): Promise<void>;
    meshNames(): Promise<LocalMeshName[]>;
    keepMeshName(row: LocalMeshName): Promise<void>;
    recordChatMove(row: LocalChatMove): Promise<void>;
    recordAccountRecovery(row: LocalAccountRecovery): Promise<void>;
    replaceIdentity(identity: Omit<LocalIdentity, 'id'>): Promise<void>;
    ensureIdentity(devicePublicKey: Buffer, createdAt: number): Promise<EnsuredIdentity>;
    resolveSession(deviceId: Buffer, opts?: ResolveSessionOptions): Promise<ResolvedSession>;
    createCandidateSession(seed: Buffer, baseKey: Buffer, { role, workspaceKey }?: CandidateSessionOptions): ResolvedSession;
    private _activeMembership;
    private _membership;
    private _migrateLegacySession;
    private _legacyMembership;
    recordMesh(key: Buffer, session: ResolvedSession, { deviceId, account }: RecordMeshOptions): Promise<void>;
    setAccountMesh(deviceId: Buffer, key: Buffer): Promise<void>;
    recordDeparture(key: Buffer, opts: RecordDepartureOptions): Promise<void>;
    departures(): Promise<LocalMeshDeparture[]>;
    departureRole(departure: LocalMeshDeparture): Promise<MeshRole>;
    deleteDeparture(key: Buffer): Promise<void>;
    archiveMesh(key: Buffer): Promise<void>;
    readPurge(key: Buffer): Promise<LocalMeshPurge | null>;
    pendingPurges(): Promise<LocalMeshPurge[]>;
    dropMesh(key: Buffer, opts?: DropMeshOptions): Promise<boolean>;
    dropLeftMeshes(): Promise<void>;
    private _dropMeshRows;
    private _dropSettledMoves;
    private _dropMeshConfig;
    private _dropRows;
    markAwaitingAdmission(key: Buffer, opts: MarkAwaitingAdmissionOptions): Promise<void>;
    setMeshRole(key: Buffer, role: MeshRole): Promise<void>;
    awaitsAdmission(key: Buffer): Promise<boolean>;
    markMeshMigrated(key: Buffer, migratedAt: number): Promise<void>;
    adoptAccountMesh(deviceId: Buffer, key: Buffer, { account, keepName }: AdoptAccountMeshOptions): Promise<void>;
    private _pointersAt;
    listMeshes(): Promise<LocalMeshMembership[]>;
    listArchivedMeshes(): Promise<ArchivedMeshMembership[]>;
    accountMesh(deviceId: Buffer): Promise<LocalMeshMembership | null>;
    meshRecord(key: Buffer): Promise<LocalMeshMembership | null>;
    readMeshSession(key: Buffer): Promise<ResolvedSession | null>;
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    close(): Promise<void>;
}
export {};
