import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
import { type AgentPicks } from './shared-agents.ts';
export declare function ownCopies(workspace: Mesh, deviceId: Buffer): Promise<QvacAgent[]>;
export interface AgentFold {
    readonly account: Mesh;
    readonly workspace: Mesh;
    readonly projects: ReadonlyArray<Mesh>;
    readonly picks: AgentPicks;
}
export declare function foldAgents(fold: AgentFold, copies: ReadonlyArray<QvacAgent>): Promise<void>;
