import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export declare function copyAgent(account: Mesh | null, into: Mesh, agentId: string | null | undefined): Promise<void>;
export interface FollowOptions {
    readonly deviceId: Buffer | null;
    readonly agentId?: string;
}
export declare function followAgentCopies(account: Mesh, into: Mesh, { deviceId, agentId }: FollowOptions): Promise<void>;
export declare function keepCopyChats(into: Mesh, agent: QvacAgent, deviceId: Buffer | null): Promise<void>;
