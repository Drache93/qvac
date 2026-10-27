import type HyperDB from 'hyperdb';
import type { QvacChunk, QvacUpdateChunkOperation } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh, MeshDispatcher } from './mesh.ts';
import { type Bounds } from './range.ts';
type ChunkPayload = Pick<QvacChunk, 'userMessage' | 'content' | 'thinking' | 'toolCall' | 'toolResult' | 'attachment' | 'approvalRequest' | 'runStatus' | 'runRequest' | 'sources' | 'compaction' | 'context' | 'modelRequest' | 'roundReset' | 'agentSwitch'>;
type AppendChunkInput = Pick<QvacChunk, 'chatId' | 'runId' | 'type' | 'originDeviceId' | 'parentId' | 'effect' | 'intent' | 'display' | 'rawCall' | 'capability' | 'capabilityArgs' | 'enhance' | 'senderNameAtSend' | 'sourceId' | 'round' | 'callId' | 'resumed' | 'runnerDeviceId'> & ChunkPayload & {
    id?: string;
};
type UpdateChunkInput = Pick<QvacChunk, 'id' | 'runStatus' | 'attachment'>;
export interface ChunkByChatKey {
    chatId: string;
    seq: number;
}
export declare const HISTORY_CHUNK_TYPES: QvacChunk['type'][];
type MediaKind = 'audio' | 'image' | 'video' | 'other';
type AttachmentOrigin = 'uploaded' | 'generated';
type ListAttachmentsByKindInput = Bounds & {
    kind: MediaKind;
    origin?: AttachmentOrigin;
};
export type ReadChunk = QvacChunk & {
    readonly attachment?: (NonNullable<QvacChunk['attachment']> & {
        readonly url?: string;
    }) | null;
};
export declare function recordLinks(store: Mesh, chunks: ReadChunk[]): Promise<ReadChunk[]>;
type ListChunksInput = Bounds & {
    chatId: string;
    type?: QvacChunk['type'];
    types?: ReadonlyArray<QvacChunk['type']>;
};
export interface FindChunksOfTypeInput extends Bounds {
    readonly chatId: string;
    readonly type: QvacChunk['type'];
}
export declare function findChunksOfType(snap: HyperDB, { chatId, type, ...bounds }: FindChunksOfTypeInput): Promise<QvacChunk[]>;
export declare function listChunks(store: Mesh, { chatId, type, types, ...bounds }: ListChunksInput): Promise<ReadChunk[]>;
export declare function listAttachmentsByKind(store: Mesh, { kind, origin, ...bounds }: ListAttachmentsByKindInput): Promise<ReadChunk[]>;
export declare function getChunk(store: Mesh, id: string): Promise<QvacChunk | null>;
export declare function mustGetChunk(store: Mesh, id: string): Promise<QvacChunk>;
export interface AppendedChunk {
    readonly id: string;
}
export declare function requireChatIn(store: Mesh, chatId: string): Promise<void>;
export declare function ownedByUs(store: Mesh, chunk: QvacChunk): Promise<boolean>;
export declare function requireProjectMember(store: Mesh, meshId: string): Promise<void>;
export declare function answersRound(store: Mesh, parentId: string | null | undefined): Promise<boolean>;
export declare function requireOwnRun(store: Mesh, chatId: string, runId: string): Promise<void>;
interface RunAddress {
    readonly meshId: string;
    readonly chatId: string;
    readonly runId: string;
}
export declare function requireStoppableRun(store: Mesh, { meshId, chatId, runId }: RunAddress): Promise<void>;
export declare function appendChunk(store: Mesh, { id, chatId, runId, type, originDeviceId, parentId, effect, intent, display, rawCall, capability, capabilityArgs, enhance, senderNameAtSend, sourceId, round, callId, resumed, runnerDeviceId, ...payload }: AppendChunkInput, into?: MeshDispatcher): Promise<AppendedChunk>;
export declare function updateChunk(store: Mesh, { id, runStatus, attachment }: UpdateChunkInput): Promise<QvacChunk>;
export declare function updateOp(chunk: QvacChunk, { id, runStatus, attachment }: UpdateChunkInput): QvacUpdateChunkOperation;
export interface ResolveApprovalInput {
    readonly id: string;
    readonly approved: boolean;
    readonly scope?: 'once' | 'always';
    readonly expiresAt?: number;
    readonly agentId?: string;
}
export declare function othersApproval(store: Mesh, id: string): Promise<boolean>;
export declare function resolveApproval(store: Mesh, { id, approved, scope, expiresAt, agentId }: ResolveApprovalInput, rules?: Mesh | null): Promise<QvacChunk>;
export declare function listRunRequests(store: Mesh, deviceId: Buffer | null): Promise<QvacChunk[]>;
export {};
