import type { Capabilities } from '../spec/capabilities.d.ts';
import type { AssistantChunk, AssistantChunkContentAttachment, AssistantEnhanceMode, AssistantRagSource, AssistantRunState } from '../spec/hyperschema/types.d.ts';
export type TaskEngine = Pick<Capabilities, 'chunksWatch' | 'sendMessage'>;
export interface TaskRequest {
    readonly agentId: string;
    readonly meshId: string;
    readonly prompt: string;
    readonly chatId?: string;
    readonly skill?: string;
    readonly capability?: string;
    readonly capabilityArgs?: unknown;
    readonly enhance?: AssistantEnhanceMode;
}
export interface TaskToolCall {
    readonly name: string;
    readonly arguments: unknown;
}
export interface TaskResult {
    readonly chatId: string;
    readonly runId: string;
    readonly state: AssistantRunState;
    readonly text: string;
    readonly thinking: string;
    readonly toolCalls: ReadonlyArray<TaskToolCall>;
    readonly attachments: ReadonlyArray<AssistantChunkContentAttachment>;
    readonly sources: ReadonlyArray<AssistantRagSource>;
    readonly reason: string | null;
    readonly metrics: unknown;
    readonly chunks: ReadonlyArray<AssistantChunk>;
}
export declare function runTask(engine: TaskEngine, request: TaskRequest): Promise<TaskResult>;
