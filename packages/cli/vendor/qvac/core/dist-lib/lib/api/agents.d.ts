import type { LoggerInterface } from '@qvac/logging';
import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import { type MeshPool } from './current-mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { MeshStatusSource } from './mesh.ts';
import type { AgentFolders } from './agent-folders.ts';
type AgentCapabilities = Pick<CapabilityHandlers, 'createAgent' | 'listAgents' | 'getAgent' | 'getDefaultAgent' | 'updateAgent' | 'deleteAgent' | 'agentsWatch' | 'shareAgent' | 'unshareAgent'>;
export interface CreateAgentsApiOptions {
    readonly deviceId: Buffer | null;
    readonly changed?: ((agentId: string) => Promise<void>) | null;
    readonly keepCopies?: ((agent: QvacAgent) => Promise<void>) | null;
    readonly peers?: Pick<MeshStatusSource, 'watch' | 'unwatch' | 'snapshot'> | null;
    readonly accountChanges?: AccountChanges | null;
    readonly folders: AgentFolders | null;
    readonly log: LoggerInterface | null;
}
interface AccountChanges {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
}
export declare function createAgentsApi(pool: MeshPool, { deviceId, changed, keepCopies, peers, accountChanges, folders, log }: CreateAgentsApiOptions): AgentCapabilities;
export {};
