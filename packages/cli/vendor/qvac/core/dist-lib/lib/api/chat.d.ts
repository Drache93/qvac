import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type AgentPicks } from '../core/shared-agents.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { Mesh } from '../core/mesh.ts';
import { type MeshPool } from './current-mesh.ts';
import type { ProjectOf } from './projects.ts';
type LocalStore = ReturnType<typeof openLocalStore>;
type ChatCapabilities = Pick<CapabilityHandlers, 'createChat' | 'listChats' | 'getChat' | 'renameChat' | 'setChatSuggestion' | 'markChatRead' | 'setChatAgent' | 'setChatProject' | 'forkChat' | 'setChatRagEnabled' | 'setChatWebSearchEnabled' | 'setChatKnowledgeSource' | 'deleteChat' | 'chatsWatch' | 'listChatActivity' | 'chatActivityWatch' | 'searchChats'>;
export interface CreateChatApiOptions {
    readonly account?: () => Mesh | null;
    readonly agents?: AgentPicks | null;
    readonly deviceId: Buffer | null;
    readonly inferenceCalls?: {
        forget(chatId: string): Promise<void>;
    } | null;
    readonly deletedProject?: ProjectGone;
    readonly projectOf?: ProjectOf | null;
    readonly workspaceOf?: ((projectId: string) => Promise<string | null>) | null;
    readonly log: LoggerInterface | null;
}
type ProjectGone = ((projectId: string) => Promise<boolean>) | null;
export declare function createChatApi(pool: MeshPool, local: LocalStore, { account, agents, deviceId, inferenceCalls, deletedProject, projectOf, workspaceOf, log }: CreateChatApiOptions): ChatCapabilities;
export {};
