import { errorMessage } from './guards.js';
import { snapshotEquals } from './api/watchable.js';
export function startCustomModelPusher(harness, state, opts = {}) {
    const { logger, onPushed } = opts;
    let disposed = false;
    let tail = Promise.resolve();
    let queued = false;
    let pushed = null;
    const push = async () => {
        const rows = await state.getCustomModelRows();
        const entries = rows.map((row) => ({
            name: row.name,
            src: row.src,
            projectionSrc: row.mmprojSrc ?? undefined,
            taskType: row.taskType ?? undefined,
            expectedSize: row.expectedSize || undefined,
            label: row.label || undefined,
            contextLength: row.contextLength || undefined
        }));
        if (disposed || snapshotEquals(entries, pushed)) {
            return;
        }
        await harness.setCustomModels?.(entries);
        pushed = entries;
        if (!disposed) {
            onPushed?.();
        }
    };
    const schedule = () => {
        if (disposed || queued)
            return;
        queued = true;
        tail = tail.then(async () => {
            queued = false;
            if (disposed) {
                return;
            }
            try {
                await push();
            }
            catch (err) {
                logger?.warn('custom-model-pusher', 'push failed', errorMessage(err));
            }
        });
    };
    const listener = () => schedule();
    state.watch(listener);
    schedule();
    return async () => {
        disposed = true;
        state.unwatch(listener);
        await tail;
    };
}
