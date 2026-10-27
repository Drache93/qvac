import b4a from 'b4a';
import { enrichAll } from './chat.js';
import { ownReads } from './chat-read.js';
import { listChatGroupsIn } from './chat-group.js';
import { ACTIVE_CHATS, CHATS, CHUNK_COUNTERS } from './collections.js';
import { syncChatTombstone } from './sync/chats.js';
export function chatSortKey(chat) {
    return chat.rank && (chat.rankedAt ?? 0) >= chat.lastActivityAt ? chat.rank : chat.lastActivityAt;
}
export function sortKeyBytes(value) {
    const bytes = b4a.alloc(8);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat64(0, value);
    return bytes;
}
export async function refreshChatOrder(mesh, local, chatIds) {
    const snap = mesh.view.snapshot();
    try {
        const rows = [];
        const gone = [];
        for (const chatId of chatIds) {
            const chat = await snap.get(CHATS, { id: chatId });
            if (!chat || chat.deletedAt) {
                gone.push(chatId);
                continue;
            }
            rows.push({ chatId, sortKey: await sortKeyOf(snap, chat) });
        }
        await local.writeChatOrder(mesh.key, rows, gone);
    }
    finally {
        await snap.close();
    }
}
export async function rebuildChatOrder(mesh, local) {
    const snap = mesh.view.snapshot();
    try {
        const rows = [];
        for (const chat of await snap.find(ACTIVE_CHATS).toArray()) {
            rows.push({ chatId: chat.id, sortKey: await sortKeyOf(snap, chat) });
        }
        const live = new Set(rows.map((row) => row.chatId));
        const stored = await local.listChatOrder(mesh.key);
        await local.writeChatOrder(mesh.key, rows);
        return stored.map((row) => row.chatId).filter((chatId) => !live.has(chatId));
    }
    finally {
        await snap.close();
    }
}
export async function retireGoneChats(mesh, local, chatIds) {
    for (const chatId of chatIds) {
        if (mesh.closing)
            return;
        const chat = await mesh.view.get(CHATS, { id: chatId });
        if (chat) {
            syncChatTombstone(mesh, chat);
        }
        await local.writeChatOrder(mesh.key, [], [chatId]);
    }
}
async function sortKeyOf(snap, chat) {
    const counter = await snap.get(CHUNK_COUNTERS, { chatId: chat.id });
    return sortKeyBytes(chatSortKey({ ...chat, lastActivityAt: counter?.lastActivityAt || chat.createdAt }));
}
export async function listChatPage(mesh, local, { limit, cursor } = {}) {
    await mesh.synced();
    await mesh.chatOrderBuilt;
    const before = cursor === undefined ? undefined : decodeCursor(cursor);
    const ordered = await local.listChatOrder(mesh.key, { limit, before });
    const snap = mesh.view.snapshot();
    try {
        const rows = [];
        const activity = new Map();
        for (const entry of ordered) {
            const chat = await snap.get(CHATS, { id: entry.chatId });
            if (!chat || chat.deletedAt) {
                continue;
            }
            const counter = await snap.get(CHUNK_COUNTERS, { chatId: chat.id });
            activity.set(chat.id, counter?.lastActivityAt || chat.createdAt);
            rows.push(chat);
        }
        const groups = await listChatGroupsIn(snap);
        const liveGroups = new Set(groups.map((group) => group.id));
        const reads = await ownReads(snap, rows, mesh.ourMemberId);
        return {
            chats: enrichAll(rows, { activity, liveGroups, reads }).reverse(),
            groups,
            nextCursor: nextCursorOf(ordered, limit)
        };
    }
    finally {
        await snap.close();
    }
}
function nextCursorOf(ordered, limit) {
    if (limit === undefined || ordered.length < limit) {
        return undefined;
    }
    const last = ordered[ordered.length - 1];
    return encodeCursor(last.sortKey, last.chatId);
}
function encodeCursor(sortKey, chatId) {
    return b4a.toString(b4a.concat([sortKey, b4a.from(chatId)]), 'base64');
}
function decodeCursor(cursor) {
    const raw = b4a.from(cursor, 'base64');
    return { sortKey: raw.subarray(0, 8), chatId: b4a.toString(raw.subarray(8)) };
}
