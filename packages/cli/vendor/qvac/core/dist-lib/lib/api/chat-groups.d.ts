import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
type ChatGroupCapabilities = Pick<CapabilityHandlers, 'createChatGroup' | 'listChatGroups' | 'renameChatGroup' | 'deleteChatGroup' | 'setChatGroup' | 'moveChat' | 'moveChatGroup' | 'sortChatGroupsByName'>;
export declare function createChatGroupsApi(pool: MeshPool): ChatGroupCapabilities;
export {};
