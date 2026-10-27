import ScopeLock from 'scope-lock';
import { MODEL_IDLE_UNLOAD_KEY, MODEL_IDLE_UNLOAD_MINUTES } from './constants.js';
import { errorMessage } from './guards.js';
export function startModelIdlePusher(harness, state, logger) {
    const lock = new ScopeLock({ debounce: true });
    let disposed = false;
    let pushed = null;
    const push = async () => {
        const ms = idleUnloadMs(await state.get(MODEL_IDLE_UNLOAD_KEY));
        if (disposed || ms === pushed) {
            return;
        }
        await harness.setModelIdleTimeout?.(ms);
        pushed = ms;
    };
    const schedule = async () => {
        if (disposed || !(await lock.lock()))
            return;
        try {
            await push();
        }
        catch (err) {
            logger?.warn('model-idle-pusher', 'push failed', errorMessage(err));
        }
        finally {
            lock.unlock();
        }
    };
    const listener = () => void schedule();
    state.watch(listener);
    void schedule();
    return async () => {
        disposed = true;
        state.unwatch(listener);
        lock.destroy();
        await lock.flush();
    };
}
function idleUnloadMs(value) {
    return typeof value === 'number' && MODEL_IDLE_UNLOAD_MINUTES.includes(value) ? value * 60_000 : 0;
}
