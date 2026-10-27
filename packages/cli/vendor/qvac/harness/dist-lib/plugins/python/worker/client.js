import { AbortController } from 'bare-abort-controller';
import process from 'process';
import { fileURLToPath } from 'url';
import { AbortedError, raceAbort } from '../../../lib/helpers/race-abort.js';
import { HarnessError } from '../../../lib/errors.js';
import { HarnessLog } from '../../../lib/log.js';
import { RESEND_MS, SIGINT } from '../deadline-state.js';
import { fromWireResult } from './protocol.js';
import { activeWorker, destroy, drainAndReap, forget, grace, readMessage } from './active.js';
import { spawnPythonWorker, preloadWorker } from './spawn.js';
function interruptGraceMs() {
    const ms = Number(process.env.QVAC_PYODIDE_INTERRUPT_GRACE_MS);
    return ms > 0 ? ms : 30_000;
}
function workerEntry() {
    return (process.env.QVAC_PYODIDE_WORKER_ENTRY ||
        fileURLToPath(import.meta.resolve('#pyodide-worker-entry')));
}
export function preloadPythonAddons() {
    return preloadWorker(workerEntry());
}
async function awaitReady(link) {
    const message = await readMessage(link);
    if (message?.type === 'ready') {
        return;
    }
    if (message?.type === 'boot-error') {
        throw new HarnessError('PYTHON_WORKER_FAILED', [message.message]);
    }
    throw new Error('python worker sent an unexpected first message');
}
function boot() {
    HarnessLog.info('python: booting worker thread');
    const sab = new SharedArrayBuffer(1);
    const link = spawnPythonWorker(workerEntry(), { sab, log: HarnessLog.level() });
    const worker = {
        link,
        view: new Uint8Array(sab),
        ready: awaitReady(link).then(() => HarnessLog.info('python: worker ready')),
        nextId: 1
    };
    worker.ready.catch(() => {
        forget(worker);
        link.kill();
    });
    return worker;
}
async function resultFor(worker, id, askConnect) {
    let message = await readMessage(worker.link);
    while (message?.type === 'connect-ask') {
        const allowed = askConnect ? await askConnect(message.host).catch(() => false) : false;
        await worker.link.write({ type: 'connect-answer', allowed });
        message = await readMessage(worker.link);
    }
    if (message?.type === 'result') {
        if (message.id !== id) {
            throw new Error('python worker answered a different run');
        }
        return { result: fromWireResult(message.result), evict: message.evict };
    }
    if (message?.type === 'boot-error') {
        throw new HarnessError('PYTHON_WORKER_FAILED', [message.message]);
    }
    throw new Error('python worker sent an unexpected message');
}
async function interrupt(worker, outcome) {
    Atomics.store(worker.view, 0, SIGINT);
    const resend = setInterval(() => Atomics.store(worker.view, 0, SIGINT), RESEND_MS);
    const graceMs = interruptGraceMs();
    const timer = grace(graceMs);
    try {
        const settled = await Promise.race([
            outcome.then(() => 'done', () => 'done'),
            timer.expired
        ]);
        if (settled === 'grace') {
            HarnessLog.warn('python: worker ignored interrupt; killing', { graceMs });
            destroy(worker);
        }
        else {
            Atomics.store(worker.view, 0, 0);
        }
    }
    finally {
        clearInterval(resend);
        timer.clear();
    }
}
export async function runPythonInWorker(spec, opts) {
    const worker = activeWorker(boot);
    worker.link.ref();
    try {
        const id = worker.nextId++;
        Atomics.store(worker.view, 0, 0);
        let cancelled = false;
        let sent = false;
        const stop = new AbortController();
        const ask = opts.askConnect;
        const outcome = (async () => {
            await worker.ready;
            if (cancelled) {
                throw new AbortedError();
            }
            sent = true;
            await worker.link.write({ type: 'run', id, spec });
            return resultFor(worker, id, ask && ((host) => raceAbort(ask(host), stop.signal)));
        })();
        let timer;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => resolve('timeout'), opts.timeoutMs);
        });
        const cancel = async () => {
            cancelled = true;
            stop.abort(undefined);
            if (sent) {
                await interrupt(worker, outcome);
            }
            else {
                outcome.catch(noop);
            }
        };
        let first;
        try {
            first = await raceAbort(Promise.race([outcome, timeout]), opts.signal);
        }
        catch (error) {
            if (error instanceof AbortedError) {
                await cancel();
                throw error;
            }
            destroy(worker);
            throw error;
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
        if (first === 'timeout') {
            await cancel();
            throw new HarnessError('COMMAND_TIMED_OUT', [opts.timeoutMs]);
        }
        if (first.evict) {
            await drainAndReap(worker);
        }
        return first.result;
    }
    finally {
        worker.link.unref();
    }
}
function noop() { }
