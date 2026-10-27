import type { AbortSignal } from 'bare-abort-controller';
import { type ChatListing } from './chat.ts';
import type { Mesh } from './mesh.ts';
export type ChatSearchMatch = 'title' | 'content';
export interface ChatSearchHit {
    readonly chat: ChatListing;
    readonly match: ChatSearchMatch;
    readonly snippet: string;
    readonly chunkId: string;
    readonly runId: string;
}
export interface ChatSearchInput {
    readonly query: string;
    readonly limit?: number;
    readonly signal?: AbortSignal;
}
export declare function searchChats(store: Mesh, input: ChatSearchInput): Promise<ReadonlyArray<ChatSearchHit>>;
