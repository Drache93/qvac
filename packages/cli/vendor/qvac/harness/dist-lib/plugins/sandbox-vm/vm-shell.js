import { AbortedError, raceAbort } from '../../lib/helpers/race-abort.js';
import { Policy } from '../../lib/policy/index.js';
import { capOutput, DEFAULT_TIMEOUT_MS, MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
export const WORKDIR_REFUSED = 'workdir is not available: commands run inside a VM that has no host paths. ' +
    'Omit workdir and use paths inside the VM.';
export async function barevisorSandbox(options) {
    const [{ default: Sandbox }, { default: Image }] = await Promise.all([
        import('barevisor/sandbox'),
        import('barevisor/image')
    ]);
    const image = Object.assign(new Image(null, { name: 'qvac-sandbox-vm', ...options.image, network: false, agent: true }), { user: 'sandbox', uid: 1000, workspace: '/sandbox' });
    return new Sandbox({ ...options, image });
}
function bounded(promise, { timeoutMs, signal, stop }) {
    return new Promise((resolve, reject) => {
        const settle = (fn) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            fn();
        };
        const halt = (error) => {
            settle(() => reject(error));
            stop();
        };
        const onAbort = () => halt(new AbortedError());
        const timer = setTimeout(() => halt(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs);
        signal?.addEventListener('abort', onAbort, { once: true });
        promise.then((value) => settle(() => resolve(value)), (error) => settle(() => reject(error)));
    });
}
export class GuestShell {
    name = 'sandbox-vm';
    enforces = { files: 'none', network: 'none', env: true };
    _options;
    _create;
    _sandbox = null;
    _closing = Promise.resolve();
    _queue = Promise.resolve();
    constructor(options, create) {
        this._options = options;
        this._create = create;
    }
    resolve(args, ctx) {
        const command = String(args.command ?? '').trim();
        const workdir = args.workdir !== undefined && args.workdir !== null;
        const refused = ctx?.policy && Policy.enforceable(ctx.policy, this);
        let error = workdir ? WORKDIR_REFUSED : null;
        if (refused) {
            error = `${this.name} ${refused}`;
        }
        return {
            run: (execution) => error ? Promise.reject(new Error(error)) : this._serial(() => this._run(command, execution))
        };
    }
    close() {
        return this._stop();
    }
    _serial(task) {
        const run = this._queue.then(task);
        this._queue = run.catch(noop);
        return run;
    }
    async _run(command, { env, timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputChars = MAX_OUTPUT_CHARS, signal }) {
        const sandbox = await raceAbort(this._boot(), signal);
        const running = sandbox.run(command, {
            env: env ? { ...env } : undefined,
            timeout: Math.ceil(timeoutMs / 1000)
        });
        const result = await bounded(running, { timeoutMs, signal, stop: () => void this._stop() });
        return {
            stdout: capOutput(result.stdout, maxOutputChars),
            stderr: capOutput(result.stderr, maxOutputChars),
            exitCode: result.exitCode ?? 1
        };
    }
    _boot() {
        if (!this._sandbox) {
            const booting = this._open();
            this._sandbox = booting;
            booting.catch(() => {
                if (this._sandbox === booting) {
                    this._sandbox = null;
                }
            });
        }
        return this._sandbox;
    }
    async _open() {
        await this._closing;
        const sandbox = await this._create(this._options);
        try {
            await sandbox.ready();
        }
        catch (error) {
            await sandbox.close().catch(noop);
            throw error;
        }
        return sandbox;
    }
    _stop() {
        const sandbox = this._sandbox;
        this._sandbox = null;
        if (!sandbox) {
            return this._closing;
        }
        const closing = sandbox.then((each) => each.close(), noop);
        this._closing = closing.catch(noop);
        return closing;
    }
}
function noop() { }
