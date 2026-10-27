import { workerData } from 'worker_threads';
import { isRecord } from '../../../lib/guards.js';
import { ARMED, FIRED, RESEND_MS, SIGINT } from '../deadline-state.js';
function narrowDeadlineData(data) {
    if (isRecord(data)) {
        const { state, interrupt, ms } = data;
        if (state instanceof SharedArrayBuffer && interrupt instanceof SharedArrayBuffer) {
            return { state, interrupt, ms: Number(ms) };
        }
    }
    throw new Error('interrupt deadline started without { state, interrupt } worker data');
}
const data = narrowDeadlineData(workerData);
const state = new Int32Array(data.state);
const interrupt = new Uint8Array(data.interrupt);
Atomics.wait(state, 0, ARMED, data.ms);
if (Atomics.compareExchange(state, 0, ARMED, FIRED) === ARMED) {
    do {
        Atomics.store(interrupt, 0, SIGINT);
    } while (Atomics.wait(state, 0, FIRED, RESEND_MS) === 'timed-out');
}
