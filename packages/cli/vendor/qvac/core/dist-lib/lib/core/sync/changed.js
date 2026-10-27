import { AGENTS, CHATS, CHUNKS, CHUNK_COUNTERS, DEVICES, INDEXING_STATUS, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, PURGED_CHATS } from '../collections.js';
export function changed(change, collection) {
    return change.collection === collection;
}
export function liveRow(change) {
    return change.type === 'delete' ? null : change.value;
}
