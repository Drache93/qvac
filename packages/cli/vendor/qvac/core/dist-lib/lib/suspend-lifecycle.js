import Suspendify from 'suspendify';
export const ASSISTANT_WAKEUP_LINGER_MS = 6_000;
const SUSPENDIFY_TARGET_RESUME = 0;
export function createAssistantSuspendLifecycle(supervisor, options = {}) {
    const { wakeupLinger = ASSISTANT_WAKEUP_LINGER_MS, pollLinger, onSuspended = noop } = options;
    const resume = async () => {
        if (!supervisor.opened) {
            await supervisor.ready();
        }
        await supervisor.resume();
    };
    const lifecycle = new Suspendify({
        wakeupLinger,
        pollLinger,
        presuspend: async () => {
            if (!supervisor.opened) {
                await supervisor.ready();
            }
            await supervisor.presuspend();
        },
        suspend: async () => {
            if (!supervisor.opened) {
                await supervisor.ready();
            }
            await supervisor.suspend();
            if (!lifecycle.interrupted) {
                onSuspended();
            }
        },
        wakeup: async () => {
            if (!supervisor.opened) {
                await supervisor.ready();
            }
            await supervisor.wakeup();
        },
        suspendCancelled: async () => {
            if (resuming(lifecycle)) {
                await resume();
            }
        },
        resume
    });
    return lifecycle;
}
function resuming(lifecycle) {
    return 'target' in lifecycle && lifecycle.target === SUSPENDIFY_TARGET_RESUME;
}
function noop() { }
