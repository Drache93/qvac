import ScopeLock from 'scope-lock';
import { MODEL_MEMORY_CAP_DEFAULT, MODEL_MEMORY_CAP_KEY, MODEL_MEMORY_CAP_MAX, MODEL_MEMORY_CAP_MIN } from './constants.js';
import { errorMessage } from './guards.js';
export function startModelMemoryCap(harness, state, { logger, onPushed } = {}) {
    const lock = new ScopeLock({ debounce: true });
    let disposed = false;
    let pushed = null;
    let usableBytes = null;
    const push = async () => {
        const percent = memoryCapPercent(await state.get(MODEL_MEMORY_CAP_KEY));
        if (disposed || percent === pushed || !harness.setModelMemoryCap) {
            return;
        }
        await harness.setModelMemoryCap(percent === MODEL_MEMORY_CAP_MIN ? 0 : percent);
        usableBytes ??= (await harness.capability?.())?.memoryBudget?.availableBytes ?? null;
        pushed = percent;
        onPushed?.();
    };
    const schedule = async () => {
        if (disposed || !(await lock.lock()))
            return;
        try {
            await push();
        }
        catch (err) {
            logger?.warn('model-memory-cap', 'push failed', errorMessage(err));
        }
        finally {
            lock.unlock();
        }
    };
    const listener = () => void schedule();
    state.watch(listener);
    void schedule();
    return {
        summary: async () => {
            const capPercent = pushed;
            const usable = usableBytes;
            if (capPercent === null || usable === null || !harness.memoryUsage) {
                return null;
            }
            const usage = await harness.memoryUsage().catch((err) => {
                logger?.warn('model-memory-cap', 'usage read failed', errorMessage(err));
                return null;
            });
            const capBytes = Math.round((capPercent / 100) * usable);
            return usage && withUsage({ usableBytes: usable, capPercent, capBytes }, usage.usedBytes);
        },
        stop: async () => {
            disposed = true;
            state.unwatch(listener);
            lock.destroy();
            await lock.flush();
        }
    };
}
export function withUsage(cap, usedBytes) {
    return {
        ...cap,
        usedBytes,
        overCap: cap.capPercent > MODEL_MEMORY_CAP_MIN && usedBytes > cap.capBytes
    };
}
export function memoryCapPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return MODEL_MEMORY_CAP_DEFAULT;
    }
    return Math.min(MODEL_MEMORY_CAP_MAX, Math.max(MODEL_MEMORY_CAP_MIN, Math.round(value)));
}
