import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh, MeshBatch } from './mesh.ts';
export declare function ownerOf(workspace: Mesh, agent: QvacAgent): Promise<Buffer | null>;
export declare function liveSharedAgent(workspace: Mesh, agentId: string): Promise<QvacAgent | null>;
export declare function shareAgent(account: Mesh, workspace: Mesh, agentId: string): Promise<QvacAgent>;
export declare function unshareAgent(workspace: Mesh, agentId: string): Promise<void>;
export declare function followSharedAgents(account: Mesh, workspace: Mesh): Promise<void>;
export interface ListedAgent extends QvacAgent {
    readonly ownerMemberId?: Buffer;
    readonly shared: boolean;
}
export declare function workspaceAgents(workspace: Mesh, own: ReadonlyArray<QvacAgent>): Promise<ListedAgent[]>;
export type PickRefusal = 'AGENT_NOT_SHARED' | 'CHAT_AGENT_UNAVAILABLE';
export interface AgentPicks {
    pick(into: Mesh, agentId: string | null | undefined, refusal?: PickRefusal): Promise<void>;
    unpick(into: Mesh, agentId: string): Promise<void>;
}
export declare function accountPicks(account: () => Mesh | null): AgentPicks;
export interface PickScope {
    readonly account: Mesh | null;
    readonly workspace: Mesh | null;
    readonly sharePublicSeed: (workspace: Mesh, hostDeviceId: Buffer) => Promise<void>;
    readonly shareProjectSeed: (batch: MeshBatch, seal: HostSeal) => Promise<void>;
}
export interface HostSeal {
    readonly workspace: Mesh;
    readonly project: Mesh;
    readonly agent: QvacAgent;
    readonly picking?: boolean;
}
export interface AgentPick {
    readonly into: Mesh;
    readonly agentId: string | null | undefined;
    readonly refusal?: PickRefusal;
}
export declare function pickAgent(scope: PickScope, { into, agentId, refusal }: AgentPick): Promise<void>;
export declare function unpickAgent(workspace: Mesh, into: Mesh, agentId: string): Promise<void>;
export declare function followPickedAgents(workspace: Mesh, into: Mesh): Promise<void>;
export declare function runDefinition(mesh: Mesh, row: QvacAgent | null): Promise<QvacAgent | null>;
