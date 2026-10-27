import b4a from 'b4a';
import process from 'process';
import { HarnessError } from '../../errors.js';
import { headTail, joinHeadTail } from '../../helpers/head-tail.js';
import { AbortedError } from '../../helpers/race-abort.js';
export const DEFAULT_TIMEOUT_MS = 120_000;
const STOP_GRACE_MS = 2_000;
export const MAX_OUTPUT_CHARS = 8_192;
export const MAX_OUTPUT_CHARS_LIMIT = 65_536;
export function capOutput(text, limit) {
    return headTail(text, limit);
}
export function appendOutput(output, chunk) {
    const text = typeof chunk === 'string' ? chunk : b4a.toString(chunk, 'utf8');
    if (output.sink && output.total + text.length > output.limit) {
        output.sink.write(output.total > output.limit ? text : output.head + text);
    }
    if (output.head.length < output.limit) {
        output.head += text.slice(0, output.limit - output.head.length);
    }
    output.tail = (output.tail + text.slice(-output.limit)).slice(-output.limit);
    output.total += text.length;
}
export function formatOutput(output, locator) {
    return output.total <= output.limit ? output.head : joinHeadTail(output, output.limit, locator);
}
export function createCapturedOutput(limit, sink) {
    return { limit, sink, head: '', tail: '', total: 0 };
}
function terminateProcessTree(child, killProcess, signal = 'SIGTERM') {
    if (child.pid !== undefined && killProcess) {
        try {
            killProcess(-child.pid, signal);
            return;
        }
        catch {
        }
    }
    try {
        child.kill(signal);
    }
    catch {
    }
}
export function startCommand(command, options) {
    const child = options.spawn(command, {
        shell: true,
        detached: (options.platform ?? process.platform) !== 'win32',
        stdio: ['ignore', 'ignore', 'ignore'],
        cwd: options.cwd
    });
    let running = true;
    const exited = new Promise((resolve) => {
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    }).finally(() => {
        running = false;
    });
    let stopping = null;
    const stop = async () => {
        if (!running) {
            return;
        }
        terminateProcessTree(child, options.killProcess);
        let timer;
        await Promise.race([
            exited,
            new Promise((resolve) => (timer = setTimeout(resolve, STOP_GRACE_MS)))
        ]);
        clearTimeout(timer);
        terminateProcessTree(child, options.killProcess, 'SIGKILL');
    };
    return {
        exited,
        stop() {
            stopping ??= stop();
            return stopping;
        }
    };
}
export function runCommand(command, options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxOutputChars = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
    if (options.signal?.aborted) {
        return Promise.reject(new AbortedError());
    }
    return new Promise((resolve, reject) => {
        const stdout = createCapturedOutput(maxOutputChars, options.spill?.sink('stdout'));
        const stderr = createCapturedOutput(maxOutputChars, options.spill?.sink('stderr'));
        let settled = false;
        const child = options.spawn(command, {
            shell: true,
            detached: (options.platform ?? process.platform) !== 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: options.cwd,
            env: options.env ? { ...options.env } : undefined
        });
        const finish = (fn) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', onAbort);
            Promise.all([stdout.sink?.close(), stderr.sink?.close()]).then(fn);
        };
        const onAbort = () => {
            finish(() => reject(new AbortedError()));
            terminateProcessTree(child, options.killProcess);
        };
        options.signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => {
            finish(() => reject(new HarnessError('COMMAND_TIMED_OUT', [timeoutMs])));
            terminateProcessTree(child, options.killProcess);
        }, timeoutMs);
        child.stdout?.on('data', (chunk) => appendOutput(stdout, chunk));
        child.stderr?.on('data', (chunk) => appendOutput(stderr, chunk));
        child.on('error', (err) => finish(() => reject(err)));
        child.on('exit', (code) => finish(([out, err]) => resolve({
            stdout: formatOutput(stdout, out),
            stderr: formatOutput(stderr, err),
            exitCode: code ?? 1
        })));
    });
}
