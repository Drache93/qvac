import Autobee, { type AutobeeChanges, type AutobeeHost, type AutobeeNode, type AutobeeOplogRef } from 'autobee';
import BlindPeering from 'blind-peering';
import Corestore from 'corestore';
import type CorestoreStorage from 'hypercore-storage';
import HyperDB from 'hyperdb';
import Hyperblobs from 'hyperblobs';
import type { KeyPair } from 'hypercore-crypto';
import type Wakeup from 'protomux-wakeup';
import ReadyResource from 'ready-resource';
import { Files } from './files/index.ts';
import type { LoggerInterface } from '@qvac/logging';
import { Router } from '../../spec/mesh/hyperdispatch/index.js';
import type { QvacCapabilityProfile, QvacDevice, QvacMember, QvacMeshName } from '../../spec/mesh/hyperschema/types.d.ts';
import { type PendingUpdates } from './sync/view-updates.ts';
import type { AttachmentUrl } from './attachment-link.ts';
import type { MeshFileIndex } from './files/local-index.ts';
import { type DeviceAttestation } from './device-attestation.ts';
import { type MeshRole } from './contract/roles.ts';
import { type SyncActivity } from './sync-status.ts';
export interface MeshView {
    readonly db: HyperDB;
}
export interface SyncInBackgroundOptions {
    readonly focus?: string;
}
export interface DeviceMetadata {
    readonly name: string;
    readonly capabilityProfile: QvacCapabilityProfile;
    readonly recommendedModelName: string;
    readonly platform?: string;
}
export interface OrphanedBlobSweepStatus {
    readonly state: 'pending' | 'running' | 'succeeded' | 'failed';
    readonly error?: string;
}
export interface MeshOptions {
    seed?: Buffer;
    role?: MeshRole;
    key?: Buffer | null;
    writerSeed?: string;
    deviceId?: Buffer;
    logger?: LoggerInterface | null;
    blindPeerKeys?: ReadonlyArray<Buffer>;
    bootFrom?: AutobeeOplogRef | null;
    trustedDevice?: (deviceId: Buffer) => Promise<boolean>;
    wakeup?: Wakeup;
    attachmentUrl?: AttachmentUrl | null;
    fileIndex?: MeshFileIndex | null;
    pendingUpdates?: PendingUpdates | null;
    slowWriteMs?: number;
    slowDrainMs?: number;
    syncBatch?: number;
    syncPauseMs?: number;
}
export declare function meshPublicKeyFromSeed(seed: Buffer): Buffer;
export declare function isOurTrustedWriter(snap: HyperDB, writerKey: Buffer, ourMemberId: Buffer | null): Promise<boolean>;
export type BirthRow = {
    readonly id: Buffer;
    readonly joinedAt: number;
} & DeviceMetadata;
export interface BirthMember {
    readonly member: QvacMember;
    readonly proof: Buffer;
}
export interface OurMembership {
    readonly memberId: Buffer;
    readonly proof: Buffer;
    readonly attestedAt: number;
}
interface BirthOptions {
    readonly member?: BirthMember;
    readonly sharing?: boolean;
    readonly defaults?: boolean;
    readonly workspace?: WorkspaceIdentity;
    readonly project?: ProjectIdentity;
}
export interface ProjectIdentity {
    readonly name: string;
    readonly upgraded?: boolean;
}
export interface WorkspaceIdentity {
    readonly name: string;
    readonly icon?: string;
}
export interface RecoveryProof {
    readonly memberId: Buffer;
    readonly proof: Buffer;
}
export interface MembershipStats {
    readonly members: number;
    readonly attested: number;
    readonly unattested: number;
    readonly revoked: number;
}
export declare function claimableDevice(row: BirthRow): Pick<QvacDevice, 'id' | 'joinedAt' | 'name' | 'capabilityProfile' | 'recommendedModelName'>;
export interface AppendOptions {
    readonly optimistic?: boolean;
}
export interface BlindPeerStats {
    readonly key: string;
    readonly connected: boolean;
    readonly connects: number;
    readonly uploaded: number;
}
export declare class Mesh extends ReadyResource {
    private _files;
    get files(): Files;
    private readonly _store;
    private _namespaceId;
    private readonly _seed;
    private readonly _role;
    private readonly _key;
    private readonly _writerSeed;
    private readonly _log;
    private readonly _blindPeerKeys;
    private readonly _bootFrom;
    private readonly _wakeup;
    readonly attachmentUrl: AttachmentUrl | null;
    readonly fileIndex: MeshFileIndex | null;
    private readonly _scope;
    readonly router: Router;
    private readonly _keyPair;
    private readonly _deviceKeyPair;
    private readonly _encryptionKey;
    private _blindPeering;
    openedEmpty: boolean;
    foreign: boolean;
    workspaceKey: Buffer | null;
    private readonly _updates;
    private _openedAt;
    private readonly _trustedDevice;
    private _joined;
    private _orphanedBlobSweepStatus;
    private _bootInterrupted;
    private _localWriterUploadedLength;
    private _ourMemberId;
    private _name;
    private _membership;
    private readonly _deviceId;
    private readonly _slowWriteMs;
    private readonly _slowDrainMs;
    private _stallReported;
    private _admitted;
    private _birth;
    private _rulesRaised;
    private _autobee;
    private _blobs;
    private _syncActivity;
    private readonly _background;
    readonly discoveryKey: Buffer;
    get autobee(): Autobee<MeshView>;
    get blobs(): Hyperblobs;
    get syncActivity(): SyncActivity;
    get publicKey(): Buffer;
    get log(): LoggerInterface | null;
    get devicePublicKey(): Buffer;
    get key(): Buffer;
    get role(): MeshRole;
    get encryptionKey(): Buffer;
    get seed(): Buffer;
    get blindPeerKeys(): ReadonlyArray<Buffer>;
    get orphanedBlobSweepStatus(): OrphanedBlobSweepStatus;
    blindPeerStats(): Array<BlindPeerStats>;
    get ourMemberId(): Buffer | null;
    get ourDeviceId(): Buffer | null;
    get membership(): MembershipStats;
    tallyMembership(): void;
    refreshMembership(): Promise<void>;
    refreshOurMember(): Promise<QvacDevice | null>;
    get name(): QvacMeshName | null;
    refreshName(): Promise<void>;
    setName(name: string): Promise<void>;
    sign(message: Buffer): Buffer;
    attestDevice(deviceId: Buffer): DeviceAttestation;
    constructor(store: Corestore, opts?: MeshOptions);
    _open(): Promise<void>;
    startBlindPeering(peering: BlindPeering): void;
    stopBlindPeering(): void;
    get bootFrom(): number | null;
    wakeHeldWriters(): Promise<void>;
    get writerCount(): number;
    get uptimeMs(): number;
    blindPeersConnected(): number;
    private _sinceOpen;
    private _lengths;
    private _blobCoreName;
    ownCoreDiscoveryKeys(storage: CorestoreStorage): Promise<Buffer[]>;
    openBlobs(coreKey: Buffer): Promise<Hyperblobs>;
    interruptBoot(): void;
    _close(): Promise<void>;
    private _sweepOrphanedBlobs;
    get view(): HyperDB;
    get localWriterKey(): Buffer<ArrayBufferLike>;
    signDeviceClaim(secretKey: Buffer, deviceId: Buffer, joinedAt: number): Buffer;
    get minted(): boolean;
    get writable(): boolean;
    get localLength(): number;
    get joining(): boolean;
    dispatch(name: string, payload: unknown, opts?: AppendOptions): Promise<void>;
    private _watchStall;
    private _endStall;
    private _reportStall;
    private _coresNotHeld;
    private _coreHeld;
    batch(): MeshBatch;
    private _raiseRulesLater;
    private _raiseRules;
    appendBirthOp(identity: Buffer | KeyPair, device?: DeviceMetadata, opts?: BirthOptions | (() => Promise<BirthOptions>)): Promise<void>;
    private _settleBirth;
    get joined(): boolean;
    private _appendBirthOp;
    private _bornKind;
    private _seedDefaults;
    get interrupted(): unknown;
    throwIfInterrupted(): void;
    waitForWritable(timeout?: number): Promise<void>;
    pendingUploads(): number;
    suspend(): Promise<void>;
    resume(): void;
    syncInBackground({ focus }?: SyncInBackgroundOptions): Promise<boolean>;
    focusChat(chatId: string): void;
    pickedFrom: (() => Promise<Mesh | null>) | null;
    syncChatOrder: ((chatIds: Set<string>) => Promise<void>) | null;
    chatOrderBuilt: Promise<void>;
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    _autobeeIsTrusted(key: Buffer, reference: MeshView): Promise<boolean>;
    _autobeeMostRecentTrusted(target: MeshView, reference: MeshView | null): Promise<AutobeeOplogRef | null>;
    private _vouchedByItsRow;
    _autobeeOpen(bee: unknown): MeshView;
    _autobeeWarmup(view: MeshView): Promise<void>;
    _autobeeApply(nodes: ReadonlyArray<AutobeeNode>, view: MeshView, host: AutobeeHost): Promise<void>;
    private _applyNode;
    private _halt;
    _autobeeUpdate(_view: MeshView, changes: AutobeeChanges): Promise<void>;
    synced(): Promise<void>;
    private _syncUpdate;
    private _arrive;
    private _readLanding;
    checkOwnAdmission(): Promise<void>;
    checkResumedRevocation(): Promise<'kicked' | 'left' | null>;
    ownWriterRefused(): Promise<boolean>;
}
export interface MeshDispatcher {
    dispatch(name: string, payload: unknown): void | Promise<void>;
}
type WriteWatch = (op: string, write: Promise<void>) => Promise<void>;
export interface MeshBatchOptions {
    readonly role?: MeshRole;
    readonly joined?: boolean;
    readonly watch?: WriteWatch;
}
export declare class MeshBatch {
    private readonly _autobee;
    private readonly _role;
    private readonly _joined;
    private readonly _watch;
    private _ops;
    private _names;
    constructor(autobee: Autobee<MeshView>, opts?: MeshBatchOptions);
    get size(): number;
    dispatch(name: string, payload: unknown): void;
    flush(opts?: AppendOptions): Promise<void>;
}
export interface ViewHead {
    readonly key: Buffer;
    readonly length: number;
}
export {};
