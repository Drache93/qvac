import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { raceAbort } from '../../lib/helpers/race-abort.js';
import { execEnv } from '../../lib/helpers/spawn-path.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { Policy } from '../../lib/policy/index.js';
import { runCommand } from '../../lib/tools/exec/runner.js';
import { canonicalDenyRoots, isDeniedPath } from '../../lib/tools/fs/scope.js';
const ENFORCES = { files: 'paths', network: 'on-off', env: true };
const REFUSED = 125;
const PROBE_TIMEOUT_MS = 30_000;
const NO_TIMEOUT_MS = 2 ** 31 - 1;
export class AppContainerSandbox {
    name = 'sandbox-windows';
    api = PluginRegistry.API_VERSION;
    addons = { 'bare-subprocess': () => import('bare-subprocess') };
    enforces = ENFORCES;
    shell;
    _helper;
    _denied = [];
    _prepared = new Map();
    _preparing = Promise.resolve();
    constructor({ helper } = {}) {
        this._helper = helper ?? AppContainerSandbox._shipped();
        this.shell = {
            name: 'appcontainer',
            enforces: ENFORCES,
            resolve: (args, ctx) => ({
                run: async (execution) => {
                    const policy = this._admit(ctx?.policy);
                    const command = String(args.command ?? '').trim();
                    return AppContainerSandbox._confined(await runCommand(command, {
                        ...execution,
                        spawn: await this._spawn(policy, execution)
                    }));
                }
            })
        };
    }
    validate() {
        if (process.platform !== 'win32') {
            return `AppContainer runs on Windows only, not ${process.platform}`;
        }
        return this._helper && fs.existsSync(this._helper)
            ? null
            : `has no qvac-sandbox helper for win32-${process.arch} (looked at ${this._helper ?? 'nothing'})`;
    }
    async setup(ctx) {
        this._denied = ctx.deniedRoots;
        await this._probe();
        return { exec: { shell: this.shell } };
    }
    static argv(run, line) {
        return [
            ...run.write.flatMap((root) => ['--cap', AppContainerSandbox.capability('w', root)]),
            ...run.read.flatMap((root) => ['--cap', AppContainerSandbox.capability('r', root)]),
            ...(run.network ? ['--net'] : []),
            ...(run.cwd ? ['--cwd', run.cwd] : []),
            '--',
            line
        ];
    }
    static steps({ write, read, deny }) {
        const pins = new Set();
        for (const root of deny) {
            for (let at = path.win32.dirname(root); AppContainerSandbox._within(at, write) &&
                !AppContainerSandbox._within(at, deny) &&
                !pins.has(at); at = path.win32.dirname(at)) {
                pins.add(at);
            }
        }
        return [
            ...deny.map((root) => ['--deny', root]),
            ...[...pins].map((folder) => ['--pin', folder]),
            ...write.map((root) => ['--write', AppContainerSandbox.capability('w', root), root]),
            ...read.map((root) => ['--read', AppContainerSandbox.capability('r', root), root])
        ];
    }
    static capability(kind, root) {
        const hash = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex');
        return `qvac-${kind}-${hash.slice(0, 32)}`;
    }
    _admit(policy) {
        if (!policy) {
            throw new Error("the appcontainer shell needs the run's compiled policy");
        }
        const refused = Policy.enforceable(policy, this) ??
            (policy.sockets !== 'all' && policy.sockets.length > 0
                ? 'has no Unix socket rule, so it cannot enforce a sockets list'
                : null);
        if (refused) {
            throw new Error(`${this.name} ${refused}`);
        }
        return policy;
    }
    async _spawn(policy, { cwd, signal }) {
        const deny = await canonicalDenyRoots([...new Set([...policy.files.deny, ...this._denied])], fs.promises.realpath);
        const open = (root) => !isDeniedPath(root, deny);
        const roots = await Promise.all(policy.files.write.map((root) => fs.promises.realpath(root)));
        const at = cwd === undefined ? undefined : path.resolve(cwd);
        const opened = at === undefined ? [] : [at];
        const listed = policy.files.read === 'all' ? opened : policy.files.read;
        const read = (await canonicalDenyRoots(listed, fs.promises.realpath)).filter(open);
        const write = roots.filter(open);
        const run = { write, read, deny, network: policy.network.mode === 'on', cwd: at ?? roots[0] };
        const inherited = AppContainerSandbox._env(policy);
        const spawn = await this._spawnHelper();
        await raceAbort(this._prepare(spawn, run), signal);
        return (line, opts = {}) => spawn(AppContainerSandbox.argv(run, line), {
            ...opts,
            cwd: undefined,
            env: { ...inherited, ...opts.env }
        });
    }
    async _spawnHelper() {
        const helper = this._helper;
        if (!helper) {
            throw new Error(`${this.name} has no qvac-sandbox helper for win32-${process.arch}`);
        }
        await fs.promises.access(helper);
        const { spawn } = await import('child_process');
        const spawnArgv = spawn;
        return (args, opts) => spawnArgv(helper, args, { ...opts, shell: false });
    }
    async _prepare(spawn, run) {
        const steps = await Promise.all(AppContainerSandbox.steps(run).map(async (args) => ({
            args,
            key: args.join('\0'),
            there: await fs.promises.access(args[args.length - 1]).then(() => true, () => false)
        })));
        const fresh = steps.filter(({ key }) => !this._prepared.has(key));
        const done = fresh.length > 0 ? this._enqueue(spawn, fresh) : undefined;
        await Promise.all([done, ...steps.map(({ key }) => this._prepared.get(key))]);
    }
    _enqueue(spawn, fresh) {
        const done = this._preparing.then(() => AppContainerSandbox._prepareWith(spawn, fresh.flatMap(({ args }) => args)));
        for (const { key } of fresh.filter(({ there }) => there)) {
            this._prepared.set(key, done);
        }
        this._preparing = done.catch(() => {
            for (const { key } of fresh) {
                if (this._prepared.get(key) === done) {
                    this._prepared.delete(key);
                }
            }
        });
        return done;
    }
    static async _prepareWith(spawn, steps) {
        const result = await runCommand('--prepare', {
            spawn: (arg, opts = {}) => spawn([arg, ...steps], opts),
            timeoutMs: NO_TIMEOUT_MS
        });
        if (result.exitCode !== 0) {
            const why = result.stderr.split('\n')[0].trim() || `prepare exited ${result.exitCode}`;
            throw new Error(`sandbox could not start: ${why}`);
        }
    }
    static _within(folder, roots) {
        const at = folder.toLowerCase();
        return roots.some((root) => {
            const base = root.toLowerCase();
            return at === base || at.startsWith(base.endsWith('\\') ? base : base + '\\');
        });
    }
    static _confined(result) {
        if (result.exitCode === REFUSED && result.stderr.startsWith('qvac-sandbox:')) {
            throw new Error(`sandbox could not start: ${result.stderr.split('\n')[0].trim()}`);
        }
        return result;
    }
    static _env(policy) {
        const env = execEnv(process.env, process.platform);
        const kept = policy.env;
        if (kept === 'all') {
            return env;
        }
        return Object.fromEntries(Object.entries(env).filter(([name]) => kept.includes(name)));
    }
    static _shipped() {
        if (process.platform !== 'win32') {
            return null;
        }
        if (typeof import.meta.asset === 'function') {
            return fileURLToPath(import.meta.asset('#qvac-sandbox'));
        }
        return AppContainerSandbox.prebuilt(process.arch);
    }
    static prebuilt(arch) {
        return path.join(path.dirname(fileURLToPath(import.meta.url)), 'prebuilds', `win32-${arch}`, 'qvac-sandbox.exe');
    }
    async _probe() {
        const spawn = await this._spawnHelper();
        const result = await runCommand('--probe', {
            spawn: (arg, opts = {}) => spawn([arg], opts),
            timeoutMs: PROBE_TIMEOUT_MS
        });
        if (result.exitCode !== 0) {
            throw new Error(`${this.name}: the AppContainer probe failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
        }
    }
}
