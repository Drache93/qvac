import { Worker } from 'worker_threads';
import { HarnessError } from '../../../lib/errors.js';
export function spawnPythonWorker(entry, data) {
    const worker = new Worker(entry, {
        workerData: data,
        resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 64, stackSizeMb: 8 }
    });
    const queued = [];
    const waiting = [];
    let died = null;
    const push = (value) => {
        const next = waiting.shift();
        if (next) {
            next.resolve(value);
        }
        else {
            queued.push(value);
        }
    };
    const fail = (error) => {
        if (died)
            return;
        died = error;
        for (const pending of waiting.splice(0)) {
            pending.reject(error);
        }
    };
    worker.on('message', push);
    worker.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
    worker.on('exit', (code) => fail(new HarnessError('PYTHON_WORKER_EXITED', [code])));
    worker.unref();
    return {
        read() {
            if (queued.length > 0) {
                return Promise.resolve(queued.shift());
            }
            if (died) {
                return Promise.reject(died);
            }
            return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
        },
        write(message) {
            worker.postMessage(message);
            return Promise.resolve();
        },
        kill: () => void worker.terminate(),
        reap: () => void worker.terminate(),
        ref: () => worker.ref(),
        unref: () => worker.unref()
    };
}
export function preloadWorker(entry) {
    const worker = new Worker(entry, { workerData: { preload: true } });
    return new Promise((resolve, reject) => {
        worker.once('error', reject);
        worker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`python preload worker exited with code ${code}`)));
    });
}
