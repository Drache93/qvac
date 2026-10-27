import type HyperDB from 'hyperdb';
import type { QvacChatGroup } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export declare function groupSortKey(group: QvacChatGroup): number;
export declare function byGroupOrder(a: QvacChatGroup, b: QvacChatGroup): number;
export declare function listChatGroupsIn(snap: HyperDB): Promise<QvacChatGroup[]>;
export declare function listChatGroups(store: Mesh): Promise<QvacChatGroup[]>;
export declare function getChatGroup(store: Mesh, id: string): Promise<QvacChatGroup | null>;
export declare function mustGetChatGroup(store: Mesh, id: string): Promise<QvacChatGroup>;
export declare function mustGetActiveChatGroup(store: Mesh, id: string): Promise<QvacChatGroup>;
export interface CreateChatGroupInput {
    readonly name: string;
}
export declare function createChatGroup(store: Mesh, input: CreateChatGroupInput): Promise<QvacChatGroup>;
export declare function renameChatGroup(store: Mesh, id: string, name: string): Promise<QvacChatGroup>;
export interface MoveChatGroupOptions {
    readonly afterId?: string | null;
}
export declare function moveChatGroup(store: Mesh, id: string, { afterId }: MoveChatGroupOptions): Promise<QvacChatGroup>;
export declare function sortChatGroupsByName(store: Mesh): Promise<QvacChatGroup[]>;
export declare function deleteChatGroup(store: Mesh, id: string): Promise<QvacChatGroup>;
