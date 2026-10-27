import type { QvacChat, QvacJoinedMesh } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export declare function publicSeed(accountSeed: Buffer, workspaceKey: Buffer): Buffer;
export declare function ownWorkspaceSeed(accountSeed: Buffer): Buffer;
export declare function isOwnWorkspace(account: Mesh, workspace: Mesh): boolean;
export declare function onOwnSeed(account: Mesh, meshKey: Buffer): Promise<boolean>;
export interface OwnWorkspaces {
    readonly own: Buffer | null;
    readonly lost: QvacJoinedMesh[];
}
export declare function ownWorkspaces(account: Mesh): Promise<OwnWorkspaces>;
export declare function lostMint(account: Mesh, meshKey: Buffer): Promise<boolean>;
export declare function publicMeshKey(account: Mesh, workspaceKey: Buffer): Promise<Buffer | null>;
export declare function servesAgents(mesh: Mesh, deviceId: Buffer): Promise<boolean>;
export declare function servesChat(mesh: Mesh, deviceId: Buffer, chatId: string): Promise<boolean>;
export declare function servesChunk(mesh: Mesh, deviceId: Buffer, chunkId: string): Promise<boolean>;
export declare function servedChats(mesh: Mesh, deviceId: Buffer): Promise<QvacChat[]>;
export interface PublicRecord {
    readonly key: string | null;
    readonly writerSeed: string;
    readonly migrated: boolean;
}
export declare function publicRecordKey(accountKey: Buffer, workspaceKey: Buffer): string;
export declare function leftPublicRecordKey(accountKey: Buffer, workspaceKey: Buffer): string;
export declare function isPublicRecord(value: unknown): value is PublicRecord;
export declare function freshPublicRecord(migrated?: boolean): PublicRecord;
