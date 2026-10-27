import ScopeLock from 'scope-lock';
import { errorMessage } from './guards.js';
export function startDownloadsAllowedPusher(harness, state, logger) {
    const lock = new ScopeLock({ debounce: true });
    let disposed = false;
    let pushed = null;
    const push = async () => {
        const allowed = !(await state.getAppConfigRow())?.manualModelDownloads;
        if (disposed || allowed === pushed) {
            return;
        }
        await harness.setDownloadsAllowed?.({ allowed });
        pushed = allowed;
    };
    const schedule = async () => {
        if (disposed || !(await lock.lock()))
            return;
        try {
            await push();
        }
        catch (err) {
            logger?.warn('downloads-allowed-pusher', 'push failed', errorMessage(err));
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
