import { AbortController } from 'bare-abort-controller';
import ScopeLock from 'scope-lock';
import { errorMessage } from '../../lib/guards.js';
import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { HarnessError } from '../../lib/errors.js';
import { HarnessLog } from '../../lib/log.js';
import { MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
import { startInterruptTimer } from './interrupt-timer.js';
import { pyodideLoadOptions } from './loader.js';
import { isPyodideFatal, performRun } from './run-session.js';
import { runPythonInWorker } from './worker/client.js';
export { pyodideLoadOptions };
const DEFAULT_TIMEOUT_MS = 120_000;
const PACKAGE_INSTALL_TIMEOUT_MS = 300_000;
const cache = new Map();
function getPyodide(load) {
    let loaded = cache.get(load);
    if (!loaded) {
        HarnessLog.info('python: booting interpreter');
        loaded = load()
            .then((py) => {
            HarnessLog.info('python: interpreter ready');
            return py;
        })
            .catch((error) => {
            cache.delete(load);
            HarnessLog.error('python: interpreter boot failed', {
                err: errorMessage(error)
            });
            throw error;
        });
        cache.set(load, loaded);
    }
    return loaded;
}
const runLock = new ScopeLock();
async function runInProcess(load, spec, options) {
    const deadline = Date.now() + options.timeoutMs;
    let timedOut = false;
    const stop = new AbortController();
    const ask = options.askConnect;
    const run = (async () => {
        await runLock.lock();
        try {
            const isCancelled = () => timedOut || options.signal?.aborted === true;
            if (isCancelled()) {
                throw new AbortedError();
            }
            const py = await getPyodide(load);
            const timer = startInterruptTimer(Math.max(0, deadline - Date.now()));
            py.setInterruptBuffer(timer.interrupt);
            let outcome;
            try {
                outcome = await performRun(py, spec, {
                    isCancelled,
                    askConnect: ask && ((host) => raceAbort(ask(host), stop.signal).catch(() => false))
                });
            }
            finally {
                if (timer.disarm()) {
                    timedOut = true;
                }
            }
            if (outcome.evict) {
                cache.delete(load);
                HarnessLog.warn('python: interpreter evicted; next run boots fresh');
            }
            if (timedOut) {
                throw new HarnessError('COMMAND_TIMED_OUT', [options.timeoutMs]);
            }
            return outcome.result;
        }
        catch (error) {
            if (isPyodideFatal(error)) {
                cache.delete(load);
            }
            throw error;
        }
        finally {
            runLock.unlock();
        }
    })();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            timedOut = true;
            reject(new HarnessError('COMMAND_TIMED_OUT', [options.timeoutMs]));
        }, options.timeoutMs);
    });
    try {
        return await raceAbort(Promise.race([run, timeout]), options.signal);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
        stop.abort(undefined);
    }
}
export async function runPython(code, options = {}) {
    if (options.signal?.aborted)
        throw new AbortedError();
    const timeoutMs = options.timeoutMs ??
        (options.packages?.length ? PACKAGE_INSTALL_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    const spec = {
        code,
        packages: options.packages,
        inputs: options.inputs,
        outputs: options.outputs,
        workdir: options.workdir,
        maxOutputChars: options.maxOutputChars ?? MAX_OUTPUT_CHARS,
        network: options.network === true,
        hosts: options.hosts,
        allowed: options.allowed,
        installTimeoutMs: timeoutMs
    };
    if (options.loadPyodide) {
        return runInProcess(options.loadPyodide, spec, {
            timeoutMs,
            signal: options.signal,
            askConnect: options.askConnect
        });
    }
    await runLock.lock();
    try {
        if (options.signal?.aborted) {
            throw new AbortedError();
        }
        return await runPythonInWorker(spec, {
            timeoutMs,
            signal: options.signal,
            askConnect: options.askConnect
        });
    }
    finally {
        runLock.unlock();
    }
}
