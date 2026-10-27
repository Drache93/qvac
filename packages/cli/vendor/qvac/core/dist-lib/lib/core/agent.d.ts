import type { AssistantAgentConfig, AssistantAgentUpdateConfig } from '../../spec/hyperschema/types.d.ts';
import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export declare function allTools(): Pick<QvacAgent, 'toolsScope' | 'enabledTools'>;
export declare function listAgents(store: Mesh, providerDeviceId?: Buffer): Promise<QvacAgent[]>;
export declare function getDefaultAgent(store: Mesh, providerDeviceId?: Buffer): Promise<QvacAgent | null>;
export declare function getAgent(store: Mesh, id: string): Promise<QvacAgent | null>;
export declare function isOrphaned(store: Mesh, agent: QvacAgent): Promise<boolean>;
export declare function liveProviderIds(store: Mesh): Promise<Set<string>>;
export declare function mustGetAgent(store: Mesh, id: string): Promise<QvacAgent>;
export declare function mustGetActiveAgent(store: Mesh, id: string): Promise<QvacAgent>;
export declare function landingAgentId(target: Mesh, sourceAgentId: string, agentId?: string | null): Promise<string>;
export declare function createAgent(store: Mesh, input: AssistantAgentConfig): Promise<QvacAgent>;
export declare function updateAgent(store: Mesh, agentId: string, input: AssistantAgentUpdateConfig): Promise<QvacAgent>;
export declare function rehomeAgents(store: Mesh, from: Buffer, to: Buffer): Promise<void>;
export interface DeleteAgentInput {
    readonly id: string;
    readonly keepChats?: boolean;
    readonly keepCopies?: ((agent: QvacAgent) => Promise<void>) | null;
}
export declare function deleteAgent(store: Mesh, deviceId: Buffer | null, { id, keepChats, keepCopies }: DeleteAgentInput): Promise<QvacAgent>;
