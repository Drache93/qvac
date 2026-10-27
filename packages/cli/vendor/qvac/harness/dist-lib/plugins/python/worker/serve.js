import { parentPort, workerData } from 'worker_threads';
import { errorMessage, isRecord } from '../../../lib/guards.js';
import { HarnessLog } from '../../../lib/log.js';
import { performRun } from '../run-session.js';
import { asHostMessage, toWireResult } from './protocol.js';
function narrowThreadData(data) {
    if (isRecord(data) && 'sab' in data) {
        const sab = data.sab;
        const log = 'log' in data && HarnessLog.isLevel(data.log) ? data.log : 'off';
        if (sab instanceof SharedArrayBuffer) {
            return { sab, log };
        }
    }
    throw new Error('python worker started without { sab } worker data');
}
function openPort() {
    const parent = parentPort;
    if (!parent) {
        throw new Error('python worker entry loaded on the main thread');
    }
    const queued = [];
    const waiting = [];
    parent.on('message', (value) => {
        const next = waiting.shift();
        if (next) {
            next(value);
        }
        else {
            queued.push(value);
        }
    });
    return {
        port: {
            read() {
                if (queued.length > 0) {
                    return Promise.resolve(queued.shift());
                }
                return new Promise((resolve) => waiting.push(resolve));
            },
            write: (message) => parent.postMessage(message),
            close: () => parent.close()
        },
        ...narrowThreadData(workerData)
    };
}
async function serveRuns(port, py) {
    for (;;) {
        const message = asHostMessage(await port.read());
        if (!message || message.type === 'close') {
            break;
        }
        if (message.type === 'connect-answer') {
            continue;
        }
        let closing = false;
        const askConnect = async (host) => {
            if (closing)
                return false;
            port.write({ type: 'connect-ask', host });
            const answer = asHostMessage(await port.read());
            if (answer?.type === 'connect-answer') {
                return answer.allowed;
            }
            closing = true;
            return false;
        };
        const { result, evict } = await performRun(py, message.spec, { askConnect });
        port.write({ type: 'result', id: message.id, result: toWireResult(result), evict });
        if (evict || closing) {
            break;
        }
    }
}
function refuseCodeGeneration() {
    throw new EvalError('code generation is disabled in the python worker');
}
function sealCodeGeneration() {
    const prototypes = [
        function () { },
        async function () { },
        function* () { },
        async function* () { }
    ].map((fn) => Object.getPrototypeOf(fn));
    for (const prototype of prototypes) {
        Object.defineProperty(prototype, 'constructor', {
            value: refuseCodeGeneration,
            writable: false,
            configurable: false
        });
    }
}
export async function serve(load) {
    const { port, sab, log } = openPort();
    HarnessLog.setLevel(log);
    HarnessLog.setSink((message, level) => port.write({ type: 'log', level, message }));
    try {
        const py = await load();
        sealCodeGeneration();
        py.setInterruptBuffer(new Uint8Array(sab));
        port.write({ type: 'ready' });
        await serveRuns(port, py);
    }
    catch (error) {
        port.write({ type: 'boot-error', message: errorMessage(error) });
    }
    finally {
        port.close();
    }
}
