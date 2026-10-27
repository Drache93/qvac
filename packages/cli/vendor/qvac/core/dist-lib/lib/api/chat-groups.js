import { createChatGroup, deleteChatGroup, listChatGroups, moveChatGroup, renameChatGroup, sortChatGroupsByName } from '../core/chat-group.js';
import { moveChat, setChatGroup } from '../core/chat.js';
import { requireMesh } from './current-mesh.js';
export function createChatGroupsApi(pool) {
    return {
        createChatGroup: async ({ meshId, config }) => createChatGroup(await requireMesh(pool, meshId), { name: config.name }),
        listChatGroups: async ({ meshId }) => listChatGroups(await requireMesh(pool, meshId)).then((groups) => ({ groups })),
        renameChatGroup: async ({ groupId, meshId, config }) => renameChatGroup(await requireMesh(pool, meshId), groupId, config.name),
        deleteChatGroup: async ({ groupId, meshId }) => deleteChatGroup(await requireMesh(pool, meshId), groupId),
        setChatGroup: async ({ chatId, groupId, meshId }) => setChatGroup(await requireMesh(pool, meshId), chatId, groupId),
        moveChat: async ({ chatId, groupId, afterId, meshId }) => moveChat(await requireMesh(pool, meshId), chatId, { groupId, afterId }),
        moveChatGroup: async ({ groupId, afterId, meshId }) => moveChatGroup(await requireMesh(pool, meshId), groupId, { afterId }),
        sortChatGroupsByName: async ({ meshId }) => sortChatGroupsByName(await requireMesh(pool, meshId)).then((groups) => ({ groups }))
    };
}
