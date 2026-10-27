export const EFFECT_DRAIN_TIMEOUT_MS = 5000;
const TIMED_OUT = Symbol('timed-out');
export async function raceDrain(promise, timeoutMs = EFFECT_DRAIN_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
}
export function didDrainTimeOut(value) {
    return value === TIMED_OUT;
}
