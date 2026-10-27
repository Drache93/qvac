import type { QvacChunk } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface SettleModelRequestInput {
    readonly id: string;
    readonly state: 'done' | 'failed';
    readonly result?: unknown;
    readonly reason?: string;
}
export declare function takeModelRequest(store: Mesh, id: string): Promise<QvacChunk>;
export declare function settleModelRequest(store: Mesh, { id, state, result, reason }: SettleModelRequestInput): Promise<void>;
export declare function cancelModelRequest(store: Mesh, id: string): Promise<void>;
export declare function reopenModelRequest(store: Mesh, id: string): Promise<void>;
export declare function listModelRequests(store: Mesh): Promise<QvacChunk[]>;
