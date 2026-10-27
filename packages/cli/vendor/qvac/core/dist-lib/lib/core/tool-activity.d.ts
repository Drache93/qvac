import type { QvacResourceDescriptor, QvacToolActivity, QvacToolDecision } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
import { type Bounds } from './range.ts';
export interface ToolActivityInput {
    readonly agentId: string;
    readonly originDeviceId: Buffer;
    readonly toolName: string;
    readonly decision: QvacToolDecision;
    readonly effect?: string;
    readonly arguments?: unknown;
    readonly resource?: QvacResourceDescriptor | null;
    readonly chatId?: string;
    readonly runId?: string;
    readonly at: number;
}
export interface RecordedToolActivity {
    readonly id: string;
}
export declare function recordToolActivity(store: Mesh, input: ToolActivityInput): Promise<RecordedToolActivity>;
export declare function listToolActivity(store: Mesh, agentId: string, bounds?: Bounds): Promise<QvacToolActivity[]>;
