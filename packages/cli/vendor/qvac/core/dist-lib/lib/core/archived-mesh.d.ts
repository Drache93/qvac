import type Corestore from 'corestore';
import type CorestoreStorage from 'hypercore-storage';
import type { LoggerInterface } from '@qvac/logging';
import type { LocalMeshMembership } from '../../spec/local/hyperschema/types.d.ts';
import { type PublicRecord } from './public-mesh.ts';
import { Mesh } from './mesh.ts';
export interface ArchivedMeshCounts {
    readonly chats: number;
    readonly agents: number;
    readonly knowledge: number;
}
export interface ArchivedMeshContents extends ArchivedMeshCounts {
    readonly meshId: string;
}
export interface ArchivedMeshMigration extends ArchivedMeshContents {
    readonly migrated: boolean;
    readonly migratedAt: number;
}
export interface ArchivedMeshOptions {
    readonly store: Corestore;
    readonly storage: CorestoreStorage;
    readonly deviceId: Buffer;
    readonly logger: LoggerInterface | null;
    readonly publicRecord?: (workspaceKey: Buffer) => Promise<PublicRecord | null>;
}
export declare function withArchivedMesh<T>(row: LocalMeshMembership, opts: ArchivedMeshOptions, fn: (mesh: Mesh, account: Mesh) => Promise<T>): Promise<T>;
export declare function countContents(mesh: Mesh, into?: Mesh | null, agents?: Mesh): Promise<ArchivedMeshCounts>;
export interface ConfigMeshes {
    readonly from?: Mesh;
    readonly into?: Mesh;
}
export declare function migrateContents(from: Mesh, into: Mesh, configs?: ConfigMeshes): Promise<ArchivedMeshCounts>;
