import type HyperDB from 'hyperdb';
import type { QvacChat, QvacChatSuggestion, QvacChatGroup } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export declare const TERMINAL_RUN_STATES: ReadonlySet<string>;
export interface ChatListing extends QvacChat {
    readonly lastActivityAt: number;
}
export interface Sidebar {
    readonly chats: ChatListing[];
    readonly groups: QvacChatGroup[];
}
export declare function liveGroupIds(snap: HyperDB): Promise<Set<string>>;
export declare function lastActivity(snap: HyperDB): Promise<Map<string, number>>;
export declare function enrichChat(store: Mesh, chat: QvacChat): Promise<ChatListing>;
export declare function enrichIn(snap: HyperDB, chat: QvacChat, memberId: Buffer | null): Promise<ChatListing>;
export interface ChatContext {
    readonly activity: Map<string, number>;
    readonly liveGroups: Set<string>;
    readonly reads: Map<string, number | undefined>;
}
export declare function enrichAll(chats: ReadonlyArray<QvacChat>, { activity, liveGroups, reads }: ChatContext): ChatListing[];
export declare function listSidebar(store: Mesh): Promise<Sidebar>;
export declare function listSidebarIn(snap: HyperDB, memberId: Buffer | null): Promise<Sidebar>;
export declare function listChats(store: Mesh): Promise<ChatListing[]>;
export declare function getChat(store: Mesh, id: string): Promise<QvacChat | null>;
export declare function mustGetChat(store: Mesh, id: string): Promise<QvacChat>;
export declare function mustGetActiveChat(store: Mesh, id: string): Promise<QvacChat>;
export declare function mustGetActiveChatListing(store: Mesh, id: string): Promise<ChatListing>;
export interface CreateChatInput {
    readonly agentId: string;
    readonly title: string;
    readonly projectId?: string | undefined;
}
export declare function buildChat(input: CreateChatInput): QvacChat;
export declare function createChat(store: Mesh, input: CreateChatInput): Promise<ChatListing>;
export declare function renameChat(store: Mesh, id: string, title: string): Promise<ChatListing>;
export declare function setChatSuggestion(store: Mesh, id: string, suggestion: QvacChatSuggestion): Promise<ChatListing>;
export declare function setChatProject(store: Mesh, id: string, projectId: string | undefined): Promise<ChatListing>;
export declare function setChatAgent(store: Mesh, id: string, agentId: string): Promise<ChatListing>;
export declare const AGENT_SWITCHED = "agent-switched";
export interface SwitchChatAgentOptions {
    readonly deviceId: Buffer;
    readonly agentId: string;
}
export declare function switchChatAgent(store: Mesh, id: string, { deviceId, agentId }: SwitchChatAgentOptions): Promise<ChatListing>;
export interface SetChatRagEnabledOptions {
    readonly ragEnabled: boolean;
}
export declare function setChatRagEnabled(store: Mesh, id: string, opts: SetChatRagEnabledOptions): Promise<ChatListing>;
export interface SetChatKnowledgeSourceOptions {
    readonly source: string;
    readonly enabled: boolean;
}
export declare function setChatKnowledgeSource(store: Mesh, id: string, { source, enabled }: SetChatKnowledgeSourceOptions): Promise<ChatListing>;
export declare function setChatGroup(store: Mesh, id: string, groupId: string | null | undefined): Promise<ChatListing>;
export interface MoveChatOptions {
    readonly groupId?: string | null;
    readonly afterId?: string | null;
}
export declare function moveChat(store: Mesh, id: string, { groupId, afterId }: MoveChatOptions): Promise<ChatListing>;
export declare function setChatWebSearchEnabled(store: Mesh, id: string, webSearchEnabled: boolean): Promise<ChatListing>;
export declare function markChatRead(store: Mesh, id: string): Promise<ChatListing>;
export interface CancelActiveRunsOptions {
    readonly deviceId: Buffer;
    readonly reason?: string;
    readonly agentId?: string;
    readonly queuedOnly?: boolean;
}
export declare function cancelActiveRuns(store: Mesh, chatId: string, { deviceId, reason, agentId, queuedOnly }: CancelActiveRunsOptions): Promise<string[]>;
export declare function removeChatKnowledge(store: Mesh, chatId: string, at: number): Promise<void>;
export interface RemoveChatAttachmentsOptions {
    readonly deviceId: Buffer;
    readonly at: number;
}
export declare function removeChatAttachments(store: Mesh, chatId: string, { deviceId, at }: RemoveChatAttachmentsOptions): Promise<void>;
export declare function deleteChat(store: Mesh, deviceId: Buffer | null, id: string): Promise<ChatListing>;
export declare function softDeleteChatsForAgent(store: Mesh, deviceId: Buffer | null, agentId: string): Promise<void>;
export declare const AGENT_DELETED = "agent-deleted";
export declare function cancelRunsForAgent(store: Mesh, deviceId: Buffer, agentId: string): Promise<void>;
