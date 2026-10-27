import { type AgentPicks } from '../core/shared-agents.ts';
import type { Mesh } from '../core/mesh.ts';
import { type SenderLookup } from '../core/senders.ts';
import { type MeshPool } from './current-mesh.ts';
import type { MeshStatusSource } from './mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export interface ExecutionApiOptions {
    readonly account?: () => Mesh | null;
    readonly agents?: AgentPicks | null;
    readonly senders?: SenderLookup | null;
    readonly peers?: Pick<MeshStatusSource, 'snapshot'> | null;
    readonly platform?: (() => string | null) | null;
}
export declare function createExecutionApi(pool: MeshPool, deviceId: Buffer, { account, agents, senders, peers, platform }?: ExecutionApiOptions): Pick<CapabilityHandlers, 'sendMessage' | 'runAgent' | 'stopRun'>;
