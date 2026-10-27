import { CHAT_READS, CHUNKS_BY_CHAT, CHUNK_COUNTERS, PROJECT_MEMBERS } from './collections.js';
import { keyRange } from './range.js';
async function readThrough(snap, chat, { memberId, addedAt }) {
    const own = memberId
        ? await snap.get(CHAT_READS, { chatId: chat.id, memberId })
        : null;
    if (own) {
        return own.readThrough;
    }
    return Math.max(chat.readThrough || 0, await joinedThrough(snap, chat.id, addedAt)) || undefined;
}
async function joinedThrough(snap, chatId, addedAt) {
    const counter = addedAt ? await snap.get(CHUNK_COUNTERS, { chatId }) : null;
    if (!counter) {
        return 0;
    }
    if ((counter.lastActivityAt ?? 0) < addedAt) {
        return counter.count;
    }
    let low = 0;
    let high = counter.count;
    while (low < high) {
        const mid = (low + high) >>> 1;
        const range = keyRange({ chatId }, 'seq', { gte: mid });
        const chunk = await snap.findOne(CHUNKS_BY_CHAT, range);
        if (chunk && chunk.createdAt < addedAt) {
            low = chunk.seq + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
async function readerOf(snap, memberId) {
    const member = memberId ? await snap.get(PROJECT_MEMBERS, { memberId }) : null;
    return { memberId, addedAt: member?.addedAt ?? 0 };
}
export async function ownReadThrough(snap, chat, memberId) {
    return readThrough(snap, chat, await readerOf(snap, memberId));
}
export async function ownReads(snap, chats, memberId) {
    const reader = await readerOf(snap, memberId);
    const reads = new Map();
    for (const chat of chats) {
        reads.set(chat.id, await readThrough(snap, chat, reader));
    }
    return reads;
}
