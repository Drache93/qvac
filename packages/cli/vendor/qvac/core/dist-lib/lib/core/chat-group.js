import { CoreError } from '../errors.js';
import { randomId } from './id.js';
import { place } from './rank.js';
import { ACTIVE_CHAT_GROUPS, CHAT_GROUPS } from './collections.js';
const NAME_MAX_LENGTH = 100;
export function groupSortKey(group) {
    return group.rank || 0;
}
export function byGroupOrder(a, b) {
    const ranked = groupSortKey(b) - groupSortKey(a);
    if (ranked) {
        return ranked;
    }
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an !== bn) {
        return an < bn ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
}
export async function listChatGroupsIn(snap) {
    const groups = await snap.find(ACTIVE_CHAT_GROUPS).toArray();
    return groups.sort(byGroupOrder);
}
export async function listChatGroups(store) {
    const snap = store.view.snapshot();
    try {
        return await listChatGroupsIn(snap);
    }
    finally {
        await snap.close();
    }
}
export async function getChatGroup(store, id) {
    const snap = store.view.snapshot();
    try {
        const group = await snap.get(CHAT_GROUPS, { id });
        return group;
    }
    finally {
        await snap.close();
    }
}
export async function mustGetChatGroup(store, id) {
    const group = await getChatGroup(store, id);
    if (!group) {
        throw new CoreError('CHAT_GROUP_NOT_FOUND', [id]);
    }
    return group;
}
export async function mustGetActiveChatGroup(store, id) {
    const group = await mustGetChatGroup(store, id);
    if (group.deletedAt) {
        throw new CoreError('CHAT_GROUP_NOT_FOUND', [id]);
    }
    return group;
}
function assertGroupName(name) {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new CoreError('CHAT_GROUP_NAME_EMPTY');
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
        throw new CoreError('CHAT_GROUP_NAME_TOO_LONG', [NAME_MAX_LENGTH]);
    }
    return trimmed;
}
export async function createChatGroup(store, input) {
    const now = Date.now();
    const group = {
        id: randomId(),
        name: assertGroupName(input.name),
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined
    };
    await store.dispatch('put-chat-group', { group });
    return group;
}
async function patchChatGroup(store, id, patch) {
    const current = await mustGetActiveChatGroup(store, id);
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await store.dispatch('put-chat-group', { group: updated });
    return updated;
}
export async function renameChatGroup(store, id, name) {
    return patchChatGroup(store, id, { name: assertGroupName(name) });
}
export async function moveChatGroup(store, id, { afterId }) {
    const anchor = afterId || undefined;
    if (anchor === id) {
        throw new CoreError('CHAT_GROUP_ANCHOR_SELF', [id]);
    }
    const now = Date.now();
    const snap = store.view.snapshot();
    let current;
    let placement;
    try {
        const group = await snap.get(CHAT_GROUPS, { id });
        if (!group || group.deletedAt) {
            throw new CoreError('CHAT_GROUP_NOT_FOUND', [id]);
        }
        current = group;
        const siblings = (await listChatGroupsIn(snap)).filter((sibling) => sibling.id !== id);
        let at = -1;
        if (anchor) {
            at = siblings.findIndex((sibling) => sibling.id === anchor);
            if (at === -1) {
                throw new CoreError('CHAT_GROUP_NOT_FOUND', [anchor]);
            }
        }
        placement = place(siblings, groupSortKey, { at, now });
    }
    finally {
        await snap.close();
    }
    const stamp = (row, rank) => ({
        ...row,
        rank,
        updatedAt: Math.max(now, row.updatedAt)
    });
    const batch = store.batch();
    for (const { row, rank } of placement.respaced) {
        batch.dispatch('put-chat-group', { group: stamp(row, rank) });
    }
    batch.dispatch('put-chat-group', { group: stamp(current, placement.rank) });
    await batch.flush();
    return mustGetActiveChatGroup(store, id);
}
export async function sortChatGroupsByName(store) {
    const now = Date.now();
    const batch = store.batch();
    for (const group of await listChatGroups(store)) {
        if (!group.rank)
            continue;
        batch.dispatch('put-chat-group', {
            group: { ...group, rank: 0, updatedAt: Math.max(now, group.updatedAt) }
        });
    }
    await batch.flush();
    return listChatGroups(store);
}
export async function deleteChatGroup(store, id) {
    const current = await mustGetChatGroup(store, id);
    const now = Date.now();
    const deleted = { ...current, deletedAt: now, updatedAt: now };
    await store.dispatch('put-chat-group', { group: deleted });
    return deleted;
}
