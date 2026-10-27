import type { QvacToolConfigs } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface ToolConfigKey {
    readonly agentId: string;
    readonly toolName: string;
}
export interface ToolConfigInput extends ToolConfigKey {
    readonly settings: Readonly<Record<string, unknown>>;
}
export declare function toolConfigsCarrySecret(settings: unknown): boolean;
export declare function getToolConfigs(store: Mesh, agentId: string, toolName: string): Promise<QvacToolConfigs | null>;
export declare function listToolConfigs(store: Mesh, agentId: string): Promise<QvacToolConfigs[]>;
export declare function setToolConfigs(store: Mesh, input: ToolConfigInput, agents?: Mesh): Promise<QvacToolConfigs>;
export declare function deleteToolConfigs(store: Mesh, { agentId, toolName }: ToolConfigKey, agents?: Mesh): Promise<QvacToolConfigs>;
export declare function softDeleteToolConfigsForAgent(store: Mesh, agentId: string): Promise<void>;
