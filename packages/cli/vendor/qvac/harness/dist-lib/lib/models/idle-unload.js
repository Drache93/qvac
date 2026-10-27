import { raceTimeout } from '../helpers/race-timeout.js';
const DEFAULT_TICK_MS = 60_000;
export function createIdleReaper({ sweep, waitMs, onError, now = Date.now, tickMs = DEFAULT_TICK_MS }) {
    let timeoutMs = 0;
    let inflight = 0;
    let lastActivity = now();
    let sweeping = null;
    let timer = null;
    const tick = () => {
        if (sweeping !== null || inflight > 0 || now() - lastActivity < timeoutMs) {
            return;
        }
        const run = sweep().catch(onError).catch(noop);
        sweeping = raceTimeout(run, { ms: waitMs, fallback: undefined }).finally(() => {
            sweeping = null;
            lastActivity = now();
        });
    };
    const disarm = () => {
        if (timer !== null) {
            clearInterval(timer);
        }
        timer = null;
    };
    return {
        configure(ms) {
            timeoutMs = ms;
            disarm();
            if (ms <= 0) {
                return;
            }
            timer = setInterval(tick, Math.min(tickMs, ms));
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
        },
        async enter() {
            inflight++;
            lastActivity = now();
            if (sweeping !== null) {
                await sweeping;
            }
        },
        exit() {
            inflight--;
            lastActivity = now();
        },
        close: disarm
    };
}
function noop() { }
