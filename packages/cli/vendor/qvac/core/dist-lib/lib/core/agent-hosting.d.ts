import type { KeyPair } from 'hypercore-crypto';
import type { QvacAgentJoin } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface AgentJoinClaim {
    readonly device: KeyPair;
    readonly writerKey: Buffer;
    readonly agentId: string;
    readonly at: number;
}
export declare function agentJoin(mesh: Mesh, { device, writerKey, agentId, at }: AgentJoinClaim): QvacAgentJoin;
export interface HostTarget {
    readonly meshKey: Buffer;
    readonly seed: Buffer;
    readonly role: 'public' | 'project';
    readonly agentIds: string[];
}
export declare function hostTargets(workspace: Mesh, device: KeyPair): Promise<HostTarget[]>;
export type HostState = 'hosting' | 'held' | 'due';
export declare function hostState(mesh: Mesh, agentId: string, deviceId: Buffer): Promise<HostState>;
export interface HostRecord {
    readonly writerSeed: string;
}
export declare function hostRecordKey(meshKey: Buffer): string;
export declare function isHostRecord(value: unknown): value is HostRecord;
export declare function freshHostRecord(): HostRecord;
