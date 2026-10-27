import type { LoggerInterface } from '@qvac/logging';
import type { AssistantMeshList } from '../../spec/hyperschema/types.d.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
import type { MeshStatusSource } from './mesh.ts';
export declare const SERVED_ROUTES: readonly ["listMeshes", "meshesWatch", "chatsWatch", "listChunks", "chunksWatch", "appendChunk", "modelRequestsWatch", "takeModelRequest", "settleModelRequest"];
export type ServedRoutes = Pick<CapabilityHandlers, (typeof SERVED_ROUTES)[number]>;
export interface ServedOptions {
    readonly pool: MeshPool;
    readonly local: Partial<Pick<CapabilityHandlers, 'chatsWatch' | 'appendChunk'>>;
    readonly foreign: (meshId: string) => boolean;
    readonly status: Pick<MeshStatusSource, 'watch' | 'unwatch'>;
    readonly list: () => Promise<AssistantMeshList>;
    readonly deviceId: Buffer | null;
    readonly log: LoggerInterface | null;
}
export declare function createServedApi({ pool, local, foreign, status, list, deviceId, log }: ServedOptions): ServedRoutes;
