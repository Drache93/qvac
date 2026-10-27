import { type Sidebar } from './chat.ts';
import type { openLocalStore } from './local/index.ts';
import type { Mesh } from './mesh.ts';
type LocalStore = ReturnType<typeof openLocalStore>;
export interface RankedChat {
    readonly rank?: number;
    readonly rankedAt?: number;
    readonly lastActivityAt: number;
}
export declare function chatSortKey(chat: RankedChat): number;
export declare function sortKeyBytes(value: number): Buffer;
export declare function refreshChatOrder(mesh: Mesh, local: LocalStore, chatIds: Iterable<string>): Promise<void>;
export declare function rebuildChatOrder(mesh: Mesh, local: LocalStore): Promise<string[]>;
export declare function retireGoneChats(mesh: Mesh, local: LocalStore, chatIds: ReadonlyArray<string>): Promise<void>;
export interface ChatPage extends Sidebar {
    readonly nextCursor?: string;
}
export interface ListChatPageOptions {
    readonly limit?: number;
    readonly cursor?: string;
}
export declare function listChatPage(mesh: Mesh, local: LocalStore, { limit, cursor }?: ListChatPageOptions): Promise<ChatPage>;
export {};
