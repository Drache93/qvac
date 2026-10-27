import { isRecord } from '../../guards.js';
export function oldestVersion(row) {
    return { ...row, version: row.chatId ? 1 : 2 };
}
export function versionedOp(name, payload) {
    if (!isRecord(payload)) {
        return payload;
    }
    if (name === 'add-knowledge' && isRecord(payload.knowledge)) {
        return { ...payload, knowledge: oldestVersion(payload.knowledge) };
    }
    if (name === 'append-chunk' && isRecord(payload.sources)) {
        return { ...payload, sources: oldestSources(payload.sources) };
    }
    return payload;
}
function oldestSources(sources) {
    const counted = !!sources.chatFilesNotReady || !!sources.projectFilesNotReady;
    return { ...sources, version: counted ? 2 : 1 };
}
