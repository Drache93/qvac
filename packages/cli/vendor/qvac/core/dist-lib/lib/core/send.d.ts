import type { QvacChat, QvacEnhanceMode } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface SendMessageInput {
    text: string;
    originDeviceId: Buffer;
    chatId?: string;
    agentId?: string;
    title?: string;
    parentRunId?: string;
    capability?: string;
    capabilityArgs?: unknown;
    enhance?: QvacEnhanceMode;
    senderNameAtSend?: string;
    peers?: ReadonlyArray<string>;
}
export interface SendMessageResult {
    chatId: string;
    chunkId: string;
    runId: string;
    chat?: QvacChat;
}
export declare function sendMessage(mesh: Mesh, input: SendMessageInput): Promise<SendMessageResult>;
export declare function parentRequestId(mesh: Mesh, chatId: string, parentRunId: string): Promise<string>;
