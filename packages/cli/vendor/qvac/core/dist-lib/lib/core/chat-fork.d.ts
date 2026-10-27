import { type ChatListing } from './chat.ts';
import type { Mesh } from './mesh.ts';
export interface ForkMeshes {
    readonly from: Mesh;
    readonly into: Mesh;
    readonly fromId?: string;
}
export interface ForkChatInput {
    readonly chatId: string;
    readonly runId?: string | null;
    readonly exclusive?: boolean;
    readonly agentId?: string | null;
    readonly title?: string | null;
    readonly originDeviceId: Buffer;
}
export declare function forkChat(meshes: ForkMeshes, input: ForkChatInput): Promise<ChatListing>;
