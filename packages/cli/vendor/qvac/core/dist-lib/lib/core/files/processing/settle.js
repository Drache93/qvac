import { AbortedError } from '@qvac/harness/race-abort';
export function settleFiles(files, options) {
    const { ids, processing, signal, timeoutMs = 5_000 } = options;
    if (signal?.aborted) {
        return Promise.reject(new AbortedError());
    }
    if (!ids.length || timeoutMs <= 0 || files.closed) {
        return Promise.resolve();
    }
    const deadline = Date.now() + timeoutMs;
    const wanted = new Set(ids);
    return new Promise((resolve, reject) => {
        let done = false;
        let checking = false;
        let dirty = false;
        const timer = setTimeout(() => finish(), timeoutMs);
        const finish = (error) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            files.unwatch(check);
            files.off('close', onClose);
            signal?.removeEventListener('abort', onAbort);
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        };
        const onClose = () => finish();
        const onAbort = () => finish(new AbortedError());
        const chats = options.chatIds();
        const check = () => {
            dirty = true;
            if (checking || done) {
                return;
            }
            checking = true;
            void (async () => {
                while (dirty && !done) {
                    dirty = false;
                    const snapshots = await Promise.all((await chats).map((chatId) => files.status(chatId)));
                    if (done) {
                        return;
                    }
                    if (!processing.active) {
                        return finish();
                    }
                    const waiting = snapshots
                        .flatMap((snapshot) => snapshot.files)
                        .some((file) => {
                        if (!wanted.has(file.fileId) || file.readyForChat)
                            return false;
                        const rag = file.processors.find((entry) => entry.processorId === 'rag');
                        if (!rag || rag.state === 'not-applicable') {
                            return false;
                        }
                        if (rag.state === 'failed' && (!rag.retryAt || rag.retryAt > deadline)) {
                            return false;
                        }
                        return (processing.pending(file.fileId) ||
                            rag.state === 'running' ||
                            (rag.retryAt !== undefined && rag.retryAt <= deadline));
                    });
                    if (!waiting) {
                        finish();
                    }
                }
            })()
                .catch(finish)
                .finally(() => {
                checking = false;
                if (dirty && !done) {
                    check();
                }
            });
        };
        files.watch(check);
        files.on('close', onClose);
        signal?.addEventListener('abort', onAbort, { once: true });
        processing.prioritize(ids);
        check();
    });
}
