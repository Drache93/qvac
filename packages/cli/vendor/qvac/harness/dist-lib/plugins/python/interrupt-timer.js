import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { errorMessage } from '../../lib/guards.js';
import { HarnessLog } from '../../lib/log.js';
import { DISARMED, FIRED } from './deadline-state.js';
export function startInterruptTimer(ms) {
    const state = new Int32Array(new SharedArrayBuffer(4));
    const interrupt = new Uint8Array(new SharedArrayBuffer(1));
    const workerData = { state: state.buffer, interrupt: interrupt.buffer, ms };
    const entry = fileURLToPath(import.meta.resolve('#pyodide-interrupt-deadline'));
    new Worker(entry, { workerData })
        .on('error', (error) => HarnessLog.warn('python: interrupt deadline failed', { err: errorMessage(error) }))
        .unref();
    return {
        interrupt,
        disarm() {
            const fired = Atomics.exchange(state, 0, DISARMED) === FIRED;
            Atomics.notify(state, 0);
            return fired;
        }
    };
}
