import type { LoggerInterface } from '@qvac/logging';
import { type AgentPicks } from '../core/shared-agents.ts';
import type { Mesh } from '../core/mesh.ts';
import { type SenderLookup } from '../core/senders.ts';
import { type MeshPool } from './current-mesh.ts';
import type { WatchableOptions } from './watchable.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type ChunkCapabilities = Pick<CapabilityHandlers, 'appendChunk' | 'updateChunk' | 'resolveApproval' | 'listChunks' | 'listAttachmentsByKind' | 'chunksWatch' | 'chunksDeltaWatch' | 'runRequestsWatch' | 'takeModelRequest' | 'settleModelRequest' | 'cancelModelRequest' | 'reopenModelRequest' | 'modelRequestsWatch' | 'takeRunRequest'>;
export interface ChunkSenders {
    readonly lookup: SenderLookup;
    readonly changes: WatchableOptions['changes'];
}
export interface ChunksApiOptions {
    readonly log: LoggerInterface | null;
    readonly account?: (() => Mesh | null) | null;
    readonly agents?: AgentPicks | null;
    readonly senders?: ChunkSenders | null;
}
export declare function createChunksApi(pool: MeshPool, deviceId: Buffer | null, { log, account, agents, senders }: ChunksApiOptions): ChunkCapabilities;
export {};
