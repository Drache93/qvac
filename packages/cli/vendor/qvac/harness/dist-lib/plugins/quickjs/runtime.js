import { errorMessage, isRecord } from '../../lib/guards.js';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { appendOutput, createCapturedOutput, DEFAULT_TIMEOUT_MS, formatOutput, MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
import { ensureTextDecoder } from './text-decoder.js';
export const MAX_DEADLINE_MS = 30_000;
export const SLICE_MS = 10_000;
const MAX_LOG_LINES = 200;
const CLOSED_ERROR = 'the JavaScript runtime is closed';
function format(ctx, handle) {
    if (ctx.typeof(handle) === 'string') {
        return ctx.getString(handle);
    }
    const value = ctx.dump(handle);
    return isRecord(value) ? JSON.stringify(value) : String(value);
}
function isPromise(ctx, handle) {
    const state = ctx.getPromiseState(handle);
    if (state.type === 'fulfilled' && state.notAPromise) {
        return false;
    }
    if (state.type === 'fulfilled') {
        state.value.dispose();
    }
    else if (state.type === 'rejected') {
        state.error.dispose();
    }
    return true;
}
function settle(ctx, promise, { print, fail }) {
    const state = ctx.getPromiseState(promise);
    promise.dispose();
    if (state.type === 'fulfilled') {
        print(state.value);
    }
    else if (state.type === 'rejected') {
        fail(state.error);
    }
}
function errorText(value) {
    if (!isRecord(value)) {
        return `Uncaught ${String(value)}`;
    }
    const head = `${String(value.name ?? 'Error')}: ${String(value.message ?? '')}`;
    const stack = typeof value.stack === 'string' ? value.stack.trimEnd() : '';
    return stack ? `${head}\n${stack}` : head;
}
const CONSOLE = [
    ['log', 'stdout'],
    ['info', 'stdout'],
    ['debug', 'stdout'],
    ['error', 'stderr'],
    ['warn', 'stderr']
];
function installConsole(ctx, write) {
    const handle = ctx.newObject();
    for (const [name, stream] of CONSOLE) {
        const fn = ctx.newFunction(name, (...args) => {
            write(stream, args.map((arg) => format(ctx, arg)).join(' '));
        });
        ctx.setProp(handle, name, fn);
        fn.dispose();
    }
    ctx.setProp(ctx.global, 'console', handle);
    handle.dispose();
}
function runScript(mod, source, { limits, deadline, maxOutputChars, signal }) {
    const limit = maxOutputChars ?? MAX_OUTPUT_CHARS;
    const output = { stdout: createCapturedOutput(limit), stderr: createCapturedOutput(limit) };
    const write = (stream, line) => appendOutput(output[stream], `${line}\n`);
    let timedOut = false;
    const rt = mod.newRuntime({
        memoryLimitBytes: limits.memoryLimit,
        maxStackSizeBytes: limits.stackSize,
        interruptHandler: () => {
            timedOut ||= Date.now() > deadline;
            return timedOut || signal?.aborted === true;
        }
    });
    const ctx = rt.newContext();
    try {
        installConsole(ctx, write);
        let exitCode = 0;
        const fail = (error) => {
            write('stderr', errorText(ctx.dump(error)));
            if (error.alive) {
                error.dispose();
            }
            exitCode = 1;
        };
        const print = (handle) => {
            if (ctx.typeof(handle) !== 'undefined') {
                write('stdout', format(ctx, handle));
            }
            handle.dispose();
        };
        const evaluated = ctx.evalCode(source, 'script.js');
        if (evaluated.error) {
            fail(evaluated.error);
        }
        else {
            const value = evaluated.value;
            const promise = isPromise(ctx, value);
            if (!promise) {
                print(value);
            }
            const jobs = rt.executePendingJobs();
            if (jobs.error) {
                fail(jobs.error);
            }
            if (promise) {
                settle(ctx, value, { print, fail });
            }
        }
        const result = {
            stdout: formatOutput(output.stdout),
            stderr: formatOutput(output.stderr),
            exitCode
        };
        return { result, timedOut };
    }
    finally {
        ctx.dispose();
        rt.dispose();
    }
}
const PRELUDE = `
{
  let seed = 0x9e3779b9
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const noClock = () => { throw new Error('the script has no clock') }
  const NativeDate = Date
  NativeDate.now = noClock
  globalThis.Date = new Proxy(NativeDate, {
    apply: noClock,
    construct: (target, args, next) => args.length ? Reflect.construct(target, args, next) : noClock()
  })
}
`;
const tick = () => new Promise((resolve) => setImmediate(resolve));
class Script {
    _ctx;
    _sliceMs;
    _totalMs;
    _settle;
    _logs = [];
    _deadline = 0;
    _spent = 0;
    _pending = new Set();
    _calls = new Set();
    _promise = null;
    _finished = false;
    _settled = false;
    constructor(mod, { limits, options, settle }) {
        this._totalMs = Math.min(options.totalMs ?? MAX_DEADLINE_MS, MAX_DEADLINE_MS);
        this._sliceMs = options.sliceMs ?? SLICE_MS;
        this._settle = settle;
        const rt = mod.newRuntime({
            memoryLimitBytes: limits.memoryLimit,
            maxStackSizeBytes: limits.stackSize,
            interruptHandler: () => Date.now() > this._deadline
        });
        this._ctx = rt.newContext();
        installConsole(this._ctx, (_stream, line) => {
            if (this._logs.length < MAX_LOG_LINES) {
                this._logs.push(line);
            }
        });
        for (const [name, functions] of Object.entries(options.bindings ?? {})) {
            const object = this._ctx.newObject();
            for (const [key, fn] of Object.entries(functions)) {
                const handle = this._ctx.newFunction(key, (arg) => this._call(fn, arg ? this._ctx.dump(arg) : undefined));
                this._ctx.setProp(object, key, handle);
                handle.dispose();
            }
            this._ctx.setProp(this._ctx.global, name, object);
            object.dispose();
        }
    }
    start(source) {
        const prelude = this._enter(() => this._ctx.evalCode(PRELUDE));
        if (prelude.error) {
            return this._fail(prelude.error);
        }
        prelude.value.dispose();
        const evaluated = this._enter(() => this._ctx.evalCode(`(async () => {\n${source}\n})()`, 'script.js'));
        if (evaluated.error) {
            return this._fail(evaluated.error);
        }
        this._promise = evaluated.value;
        this._pump();
    }
    stop = (error) => {
        this._dispose();
        this._done(() => this._settle.reject(error));
    };
    _enter(fn) {
        const started = Date.now();
        this._deadline = started + Math.min(this._sliceMs, this._totalMs - this._spent);
        try {
            return fn();
        }
        finally {
            this._spent += Date.now() - started;
        }
    }
    _call(fn, arg) {
        const deferred = this._ctx.newPromise();
        this._pending.add(deferred);
        const call = Promise.resolve(arg)
            .then(fn)
            .then((value) => tick().then(() => this._resolve(deferred, value)), (error) => this._finish(() => this._settle.reject(error)));
        this._calls.add(call);
        return deferred.handle;
    }
    _resolve(deferred, value) {
        if (this._finished)
            return;
        let handle;
        try {
            handle = this._fromJson(value);
        }
        catch (error) {
            return this._error(`the tool result could not reach the script: ${errorMessage(error)}`);
        }
        this._pending.delete(deferred);
        deferred.resolve(handle);
        handle.dispose();
        deferred.dispose();
        this._pump();
    }
    _fromJson(value) {
        let json;
        let parse;
        try {
            json = this._ctx.newString(JSON.stringify(value ?? null));
            parse = this._ctx.unwrapResult(this._ctx.evalCode('JSON.parse'));
            return this._ctx.unwrapResult(this._ctx.callFunction(parse, this._ctx.undefined, json));
        }
        finally {
            parse?.dispose();
            json?.dispose();
        }
    }
    _toJson(handle) {
        const stringify = this._ctx.unwrapResult(this._ctx.evalCode('JSON.stringify'));
        try {
            const json = this._enter(() => this._ctx.callFunction(stringify, this._ctx.undefined, handle));
            if (json.error) {
                return { error: json.error };
            }
            const text = this._ctx.typeof(json.value) === 'string' ? this._ctx.getString(json.value) : null;
            json.value.dispose();
            return { value: text === null ? null : JSON.parse(text) };
        }
        finally {
            stringify.dispose();
        }
    }
    _pump() {
        if (this._finished || !this._promise)
            return;
        const jobs = this._enter(() => this._ctx.runtime.executePendingJobs());
        if (jobs.error) {
            return this._fail(jobs.error);
        }
        const state = this._ctx.getPromiseState(this._promise);
        if (state.type === 'fulfilled') {
            const answer = this._toJson(state.value);
            state.value.dispose();
            if ('error' in answer) {
                return this._fail(answer.error, "the script's answer is not JSON: ");
            }
            const logs = this._logs;
            return this._finish(() => this._settle.resolve({ value: answer.value, logs }));
        }
        if (state.type === 'rejected') {
            return this._fail(state.error);
        }
        if (this._pending.size === 0) {
            this._error('the script awaited a promise that never settles');
        }
    }
    _fail(handle, prefix = '') {
        const error = this._ctx.dump(handle);
        if (handle.alive) {
            handle.dispose();
        }
        this._error(prefix + this._message(error));
    }
    _error(error) {
        const logs = this._logs;
        this._finish(() => this._settle.resolve({ error, logs }));
    }
    _message(error) {
        if (!isRecord(error)) {
            return String(error);
        }
        if (error.message === 'interrupted') {
            return this._spent >= this._totalMs
                ? `the script ran longer than ${this._totalMs} ms in total`
                : `the script ran longer than ${this._sliceMs} ms`;
        }
        return error.name ? `${String(error.name)}: ${String(error.message)}` : String(error.message);
    }
    _finish(settle) {
        if (this._finished)
            return;
        this._dispose();
        if (this._calls.size === 0) {
            return this._done(settle);
        }
        void Promise.allSettled(this._calls).then(() => this._done(settle));
    }
    _dispose() {
        if (this._finished)
            return;
        this._finished = true;
        this._promise?.dispose();
        for (const deferred of this._pending) {
            deferred.dispose();
        }
        const rt = this._ctx.runtime;
        this._ctx.dispose();
        rt.dispose();
    }
    _done(settle) {
        if (this._settled)
            return;
        this._settled = true;
        this._settle.done();
        settle();
    }
}
async function loadModule() {
    const [{ default: variant }, { newQuickJSWASMModuleFromVariant }] = await Promise.all([
        import('@jitl/quickjs-singlefile-mjs-release-sync'),
        import('quickjs-emscripten-core')
    ]);
    return newQuickJSWASMModuleFromVariant(variant);
}
export class Interpreter {
    _limits;
    _module = null;
    _live = new Set();
    _closed = false;
    constructor(limits) {
        this._limits = limits;
    }
    _load() {
        if (!this._module) {
            ensureTextDecoder();
            const loading = loadModule();
            this._module = loading;
            loading.catch(() => this._drop(loading));
        }
        return this._module;
    }
    _drop(module) {
        if (this._module === module) {
            this._module = null;
        }
    }
    async evaluate(source, options = {}) {
        if (this._closed) {
            throw new Error(CLOSED_ERROR);
        }
        const loading = this._load();
        const mod = await loading;
        if (this._closed) {
            throw new Error(CLOSED_ERROR);
        }
        if (options.signal?.aborted) {
            throw new AbortedError();
        }
        const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_DEADLINE_MS);
        let outcome;
        try {
            outcome = runScript(mod, source, {
                ...options,
                limits: this._limits,
                deadline: Date.now() + timeoutMs
            });
        }
        catch (err) {
            this._drop(loading);
            throw err;
        }
        if (options.signal?.aborted) {
            throw new AbortedError();
        }
        if (outcome.timedOut) {
            throw new Error(`Command timed out after ${timeoutMs}ms`);
        }
        return outcome.result;
    }
    async run(source, options = {}) {
        if (this._closed) {
            throw new Error(CLOSED_ERROR);
        }
        const mod = await this._load();
        if (this._closed) {
            throw new Error(CLOSED_ERROR);
        }
        return new Promise((resolve, reject) => {
            const script = new Script(mod, {
                limits: this._limits,
                options,
                settle: { resolve, reject, done: () => this._live.delete(script.stop) }
            });
            this._live.add(script.stop);
            script.start(source);
        });
    }
    close() {
        this._closed = true;
        this._module = null;
        for (const stop of [...this._live]) {
            stop(new Error(CLOSED_ERROR));
        }
    }
}
