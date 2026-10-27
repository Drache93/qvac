const TEXT_TYPES = new Set(['content', 'thinking']);
function resetKey(runId, round, type) {
    return JSON.stringify([runId, round, type]);
}
export function attemptStarts(chunks) {
    const starts = new Map();
    for (const chunk of chunks) {
        if (chunk.type !== 'run-status' || !chunk.runId)
            continue;
        const fresh = chunk.runStatus?.state === 'executing' &&
            !chunk.resumed &&
            chunk.runStatus.progress?.phase !== 'compacting';
        if (fresh) {
            starts.set(chunk.runId, chunk.seq);
        }
    }
    return starts;
}
export function hiddenTranscriptText(chunks) {
    const starts = attemptStarts(chunks);
    const resets = new Map();
    for (const chunk of chunks) {
        if (chunk.type !== 'round-reset' || !chunk.runId || typeof chunk.round !== 'number') {
            continue;
        }
        for (const type of chunk.roundReset?.replacedTypes ?? TEXT_TYPES) {
            resets.set(resetKey(chunk.runId, chunk.round, type), chunk.seq);
        }
    }
    const hidden = new Set();
    for (const chunk of chunks) {
        if (!TEXT_TYPES.has(chunk.type) || !chunk.runId)
            continue;
        const start = starts.get(chunk.runId);
        const reset = typeof chunk.round === 'number'
            ? resets.get(resetKey(chunk.runId, chunk.round, chunk.type))
            : undefined;
        if ((start !== undefined && chunk.seq < start) || (reset !== undefined && chunk.seq < reset)) {
            hidden.add(chunk.id);
        }
    }
    return hidden;
}
