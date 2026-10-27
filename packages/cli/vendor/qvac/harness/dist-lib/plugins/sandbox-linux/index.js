import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
import { execEnv } from '../../lib/helpers/spawn-path.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { Policy } from '../../lib/policy/index.js';
import { createShellAdapter } from '../../lib/tools/exec/adapters/shell/shell-adapter.js';
import { runCommand, startCommand } from '../../lib/tools/exec/runner.js';
import { canonicalDenyRoots, isDeniedPath } from '../../lib/tools/fs/scope.js';
import { seccompProgram } from './seccomp.js';
const ENFORCES = { files: 'paths', network: 'on-off', env: true };
const NO_POLICY = "the bwrap shell needs the run's compiled policy";
const REFUSED = 1;
const PROBE_TIMEOUT_MS = 10_000;
const WHOLE_OUTPUT = 1 << 24;
const SECCOMP_FD = 3;
const STDIO = ['pipe', 'pipe', 'pipe'];
const SYSTEM_READS = ['/usr', '/bin', '/sbin', '/lib', '/lib32', '/lib64', '/libx32', '/etc'];
const ARCHES = { x64: 'x64', arm64: 'arm64' };
async function scratch() {
    const base = await fs.promises.realpath(os.tmpdir());
    return fs.promises.mkdtemp(path.join(base, 'qvac-bwrap-'));
}
function removeDir(dir) {
    return fs.promises.rm(dir, { recursive: true, force: true });
}
function within(at, root) {
    return at === root || at.startsWith(root === '/' ? root : `${root}/`);
}
function depth(at) {
    return at.split('/').length;
}
function byDepth(paths) {
    return [...new Set(paths)].sort((a, b) => depth(a) - depth(b));
}
export class LinuxSandbox {
    name = 'sandbox-linux';
    api = PluginRegistry.API_VERSION;
    provides = ['sandbox'];
    addons = { 'bare-subprocess': () => import('bare-subprocess') };
    enforces = ENFORCES;
    shell;
    _bwrap;
    _writable;
    _denied = [];
    _stubs = new Map();
    constructor({ bwrap = '/usr/bin/bwrap', writable = [] } = {}) {
        this._bwrap = bwrap;
        this._writable = writable;
        this.shell = {
            name: 'bwrap',
            enforces: ENFORCES,
            resolve: (args, ctx) => ({
                run: async (execution) => {
                    const policy = this._admit(ctx?.policy);
                    const tmp = await scratch();
                    try {
                        const runtime = await this._runtime(policy, tmp);
                        const shell = createShellAdapter({
                            name: 'bwrap',
                            loadRuntime: () => Promise.resolve(runtime),
                            downloadNote: ''
                        });
                        return LinuxSandbox._confined(await shell.resolve(args).run(execution));
                    }
                    finally {
                        await removeDir(tmp);
                    }
                }
            })
        };
    }
    validate() {
        if (process.platform !== 'linux') {
            return `bubblewrap runs on Linux only, not ${process.platform}`;
        }
        if (!ARCHES[process.arch]) {
            return `has no seccomp program for ${process.arch}`;
        }
        const relative = this._writable.find((folder) => !path.isAbsolute(folder));
        return relative === undefined ? null : `needs absolute writable folders, not ${relative}`;
    }
    async setup(ctx) {
        this._denied = ctx.deniedRoots;
        await Promise.all(this._writable.map((folder) => fs.promises.mkdir(folder, { recursive: true })));
        await this._probe();
        return { exec: { shell: this.shell }, services: { sandbox: this._service() } };
    }
    static argv(run, line) {
        const links = Object.entries(run.links ?? {});
        const reads = run.read === 'all'
            ? ['--ro-bind', '/', '/']
            : [
                ...links.flatMap(([at, target]) => ['--symlink', target, at]),
                ...run.read.flatMap((root) => ['--ro-bind', root, root])
            ];
        return [
            '--unshare-user',
            '--unshare-pid',
            '--die-with-parent',
            ...(run.network ? [] : ['--unshare-net']),
            ...reads,
            ...run.write.flatMap((root) => ['--bind', root, root]),
            ...run.pins.flatMap((folder) => ['--bind', folder, folder]),
            '--dev',
            '/dev',
            '--proc',
            '/proc',
            ...run.folders.flatMap((root) => ['--perms', '000', '--tmpfs', root, '--remount-ro', root]),
            ...run.files.flatMap((root) => ['--ro-bind', '/dev/null', root]),
            ...(run.network ? [] : ['--seccomp', String(SECCOMP_FD)]),
            ...(run.cwd ? ['--chdir', run.cwd] : []),
            '--',
            '/bin/sh',
            '-c',
            line
        ];
    }
    static seccomp(arch) {
        return seccompProgram(arch);
    }
    _service() {
        return {
            name: this.shell.name,
            isolated: false,
            enforces: ENFORCES,
            open: async (dir, policy) => this._workspace(dir, this._admit(policy))
        };
    }
    _admit(policy) {
        if (!policy) {
            throw new Error(NO_POLICY);
        }
        const refused = Policy.enforceable(policy, this) ??
            (policy.sockets !== 'all' && policy.sockets.length > 0
                ? 'closes every socket connect with the network off, so it cannot enforce a sockets list'
                : null);
        if (refused) {
            throw new Error(`${this.name} ${refused}`);
        }
        return Policy.withWrites(policy, this._writable);
    }
    async _workspace(dir, policy) {
        const tmp = await scratch();
        const writable = { ...policy, files: { ...policy.files, write: [dir, ...policy.files.write] } };
        const runtime = () => this._runtime(writable, tmp);
        return {
            exec: async (command, { cwd, env, timeoutMs, signal } = {}) => LinuxSandbox._confined(await runCommand(command, {
                ...(await runtime()),
                cwd,
                env,
                timeoutMs,
                signal,
                maxOutputChars: WHOLE_OUTPUT
            })),
            start: async (command, { cwd } = {}) => startCommand(command, { ...(await runtime()), cwd }),
            close: () => removeDir(tmp)
        };
    }
    static _confined(result) {
        if (result.exitCode === REFUSED && result.stderr.startsWith('bwrap:')) {
            throw new Error(`sandbox could not start: ${result.stderr.split('\n')[0]}`);
        }
        return result;
    }
    async _runtime(policy, tmp) {
        const { run, stubs } = await this._prepare(policy, tmp);
        await fs.promises.access(this._bwrap, fs.constants.X_OK);
        const program = run.network ? null : seccompProgram(ARCHES[process.arch]);
        const inherited = LinuxSandbox._env(policy);
        const { spawn } = await import('child_process');
        const spawnArgv = spawn;
        const spawnFn = (line, opts = {}) => {
            const release = this._hold(stubs);
            let child;
            try {
                child = spawnArgv(this._bwrap, LinuxSandbox.argv({ ...run, cwd: opts.cwd }, line), {
                    ...opts,
                    shell: false,
                    stdio: [
                        ...(Array.isArray(opts.stdio) ? opts.stdio : STDIO),
                        ...(program ? ['pipe'] : [])
                    ],
                    env: { ...inherited, ...opts.env, TMPDIR: `${tmp}/` }
                });
            }
            catch (error) {
                release();
                throw error;
            }
            child.on('exit', release);
            child.on('error', release);
            if (program) {
                LinuxSandbox._feed(child, program);
            }
            return child;
        };
        return { spawn: spawnFn, killProcess: process.kill.bind(process) };
    }
    static _feed(child, program) {
        const pipe = child.stdio[SECCOMP_FD];
        pipe?.on('error', noop);
        pipe?.end(program);
    }
    async _prepare(policy, tmp) {
        const deny = await this._denyRoots(policy);
        const open = (root) => !isDeniedPath(root, deny);
        const roots = await Promise.all(policy.files.write.map((root) => fs.promises.realpath(root)));
        const write = byDepth([...roots.filter(open), tmp]);
        const folders = [];
        const files = [];
        const stubs = [];
        for (const root of deny) {
            const stat = await fs.promises.stat(root).catch(none);
            const missing = stat ? null : await LinuxSandbox._firstMissing(root);
            const held = [...this._stubs.keys()].find((stub) => within(root, stub));
            const stub = held ?? (missing && write.some((each) => within(missing, each)) ? missing : null);
            if (stub) {
                folders.push(stub);
                stubs.push(stub);
            }
            else if (stat) {
                ;
                (stat.isDirectory() ? folders : files).push(root);
            }
        }
        const pins = LinuxSandbox._pins([...folders, ...files], write, deny);
        const listed = policy.files.read === 'all' ? null : await this._reads(policy.files.read);
        const run = {
            read: listed ? listed.roots : 'all',
            links: listed?.links,
            write,
            pins,
            folders: byDepth(folders),
            files,
            network: policy.network.mode === 'on'
        };
        return { run, stubs };
    }
    async _denyRoots(policy) {
        const roots = await canonicalDenyRoots([...new Set([...policy.files.deny, ...this._denied])], fs.promises.realpath);
        const kept = [];
        for (const root of byDepth(roots)) {
            if (!kept.some((outer) => within(root, outer))) {
                kept.push(root);
            }
        }
        return kept;
    }
    static _pins(masks, write, deny) {
        const pins = new Set();
        for (const mask of masks) {
            for (const root of write.filter((each) => each !== mask && within(mask, each))) {
                for (let at = path.dirname(mask); at !== root && within(at, root) && !isDeniedPath(at, deny); at = path.dirname(at)) {
                    pins.add(at);
                }
            }
        }
        return byDepth(pins);
    }
    async _reads(listed) {
        const links = {};
        const roots = [];
        for (const at of SYSTEM_READS) {
            const stat = await fs.promises.lstat(at).catch(none);
            if (stat?.isSymbolicLink()) {
                links[at] = await fs.promises.readlink(at);
            }
            else if (stat) {
                roots.push(at);
            }
        }
        const real = await Promise.all(listed.map((root) => fs.promises.realpath(root).catch(none)));
        return { roots: byDepth([...roots, ...real.filter((root) => root !== null)]), links };
    }
    static async _firstMissing(root) {
        let missing = root;
        for (let at = path.dirname(root); at !== missing; at = path.dirname(at)) {
            if (await fs.promises.lstat(at).catch(none)) {
                return missing;
            }
            missing = at;
        }
        return missing;
    }
    _hold(stubs) {
        for (const stub of stubs) {
            const held = this._stubs.get(stub);
            if (held) {
                held.count++;
            }
            else {
                this._stubs.set(stub, { count: 1, made: LinuxSandbox._made(stub) });
            }
        }
        let released = false;
        return () => {
            if (!released) {
                released = true;
                stubs.forEach((stub) => this._release(stub));
            }
        };
    }
    _release(stub) {
        const held = this._stubs.get(stub);
        if (!held || --held.count > 0) {
            return;
        }
        this._stubs.delete(stub);
        if (held.made) {
            try {
                fs.rmdirSync(stub);
            }
            catch { }
        }
    }
    static _made(stub) {
        try {
            fs.mkdirSync(stub, { mode: 0o700 });
            return true;
        }
        catch {
            return false;
        }
    }
    static _env(policy) {
        const env = execEnv(process.env, process.platform);
        const kept = policy.env;
        if (kept === 'all') {
            return env;
        }
        return Object.fromEntries(Object.entries(env).filter(([name]) => kept.includes(name)));
    }
    async _probe() {
        const tmp = await scratch();
        try {
            const policy = Policy.compile({ network: { mode: 'off' } }, { write: [tmp] });
            const result = await this._runtime(policy, tmp)
                .then((runtime) => runCommand('true', { ...runtime, cwd: tmp, timeoutMs: PROBE_TIMEOUT_MS }))
                .catch((error) => ({ exitCode: -1, stderr: error.message }));
            if (result.exitCode !== 0) {
                throw new Error(`${this.name}: the bwrap probe failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
            }
        }
        finally {
            await removeDir(tmp);
        }
    }
}
function noop() { }
function none() {
    return null;
}
