import type { AssistantAddAgentFolderRequest, AssistantAgentFolders, AssistantAgentFoldersRequest, AssistantRemoveAgentFolderRequest } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export interface AgentFoldersOptions {
    readonly storageRoot: string;
}
export declare class AgentFolders {
    private readonly _state;
    private readonly _storageRoot;
    private readonly _lock;
    constructor(state: LocalStore, { storageRoot }: AgentFoldersOptions);
    list({ agentId }: AssistantAgentFoldersRequest): Promise<AssistantAgentFolders>;
    add({ agentId, path: given, access }: AssistantAddAgentFolderRequest): Promise<AssistantAgentFolders>;
    remove({ agentId, path: given }: AssistantRemoveAgentFolderRequest): Promise<AssistantAgentFolders>;
    forget(agentId: string): Promise<void>;
    private _read;
    private _update;
    private _shareable;
}
export declare function createAgentFoldersApi(folders: AgentFolders): Pick<CapabilityHandlers, 'listAgentFolders' | 'addAgentFolder' | 'removeAgentFolder'>;
export {};
