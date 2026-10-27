import { registerLoggingStream, unregisterLoggingStream } from '../runtime/logging-stream-registry.js';
export async function* handleLoggingStream(request, context = {}) {
    const { id } = request;
    const { signal } = context;
    if (signal?.aborted)
        return;
    const logQueue = [];
    let pendingResolve = null;
    const wake = () => {
        if (pendingResolve) {
            const resolve = pendingResolve;
            pendingResolve = null;
            resolve();
        }
    };
    const streamHandler = (level, namespace, message, sourceId) => {
        const logResponse = {
            type: 'loggingStream',
            // For the global ALL_LOG_ID stream `sourceId` is the real origin of the
            // log; for a per-id stream it equals the subscription `id`.
            id: sourceId,
            level: level,
            namespace,
            message,
            timestamp: Date.now()
        };
        logQueue.push(logResponse);
        wake();
    };
    // Release at once, even if nobody is reading; a quiet id would wait forever.
    const onAbort = () => {
        unregisterLoggingStream(id, streamHandler);
        logQueue.length = 0;
        wake();
    };
    registerLoggingStream(id, streamHandler);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
        while (true) {
            while (logQueue.length > 0) {
                yield logQueue.shift();
            }
            // Aborted during a read: nothing to wake, so end here.
            if (signal?.aborted)
                return;
            await new Promise((resolve) => {
                pendingResolve = resolve;
            });
        }
    }
    finally {
        signal?.removeEventListener('abort', onAbort);
        unregisterLoggingStream(id, streamHandler);
    }
}
