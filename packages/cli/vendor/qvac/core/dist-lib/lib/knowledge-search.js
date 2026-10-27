import { raceAbort } from '@qvac/harness/race-abort';
export async function searchKnowledge(engine, request, options) {
    const { signal, preparing } = options;
    const search = await raceAbort(engine.ragSearch(request), signal);
    const { attachmentIds } = request;
    if (!search.enabled ||
        !search.hasKnowledge ||
        !attachmentIds?.length ||
        !search.pendingFiles?.length) {
        return search;
    }
    const watch = engine.fileStatusWatch({ chatId: request.chatId });
    const iterator = watch[Symbol.asyncIterator]();
    let wanted = null;
    let waiting = false;
    try {
        while (true) {
            const next = await raceAbort(iterator.next(), signal);
            if (next.done) {
                throw new Error('file status closed while preparing documents');
            }
            const files = next.value.files;
            const ids = (wanted ??= attachedPending(attachmentIds, {
                files,
                pendingFiles: search.pendingFiles
            }));
            if (ids.size === 0) {
                return search;
            }
            if (!files.some((file) => ids.has(file.fileId) && pending(file))) {
                return await raceAbort(engine.ragSearch(request), signal);
            }
            if (!waiting) {
                waiting = true;
                preparing(true);
            }
        }
    }
    finally {
        watch.destroy();
        if (waiting) {
            preparing(false);
        }
    }
}
function pending(file) {
    const rag = file.processors.find((processor) => processor.processorId === 'rag');
    return (!file.readyForChat &&
        ['pending', 'running', 'uploading'].includes(file.state) &&
        rag?.state !== 'not-applicable');
}
function attachedPending(attachmentIds, { files, pendingFiles }) {
    return new Set(files
        .filter((file) => attachmentIds.includes(file.fileId) && pendingFiles.includes(file.fileName))
        .map((file) => file.fileId));
}
