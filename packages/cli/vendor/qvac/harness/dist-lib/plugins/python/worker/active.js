import { HarnessLog } from '../../../lib/log.js';
import { asWorkerMessage } from './protocol.js';
const SHUTDOWN_GRACE_MS = 3_000;
let active = null;
export function activeWorker(boot) {
    return (active ??= boot());
}
export function forget(worker) {
    if (active === worker) {
        active = null;
    }
}
export function destroy(worker) {
    forget(worker);
    worker.link.kill();
}
export async function readMessage(link) {
    for (;;) {
        const message = asWorkerMessage(await link.read());
        if (message?.type !== 'log') {
            return message;
        }
        HarnessLog[message.level](`python worker: ${message.message}`);
    }
}
export async function drainAndReap(worker) {
    forget(worker);
    const closed = readMessage(worker.link).then(() => 'message', () => 'closed');
    const timer = grace(SHUTDOWN_GRACE_MS);
    try {
        const settled = await Promise.race([closed, timer.expired]);
        if (settled === 'closed') {
            worker.link.reap();
        }
        else {
            worker.link.kill();
        }
    }
    finally {
        timer.clear();
    }
}
export function grace(ms) {
    let timer;
    const expired = new Promise((resolve) => {
        timer = setTimeout(() => resolve('grace'), ms);
    });
    return { expired, clear: () => clearTimeout(timer) };
}
export async function closePythonWorker() {
    const worker = active;
    if (!worker) {
        return;
    }
    active = null;
    const timer = grace(SHUTDOWN_GRACE_MS);
    try {
        const booted = await Promise.race([worker.ready.then(() => 'ready'), timer.expired]);
        if (booted === 'grace') {
            worker.link.kill();
            return;
        }
        await worker.link.write({ type: 'close' });
        await drainAndReap(worker);
    }
    catch {
        worker.link.kill();
    }
    finally {
        timer.clear();
    }
}
