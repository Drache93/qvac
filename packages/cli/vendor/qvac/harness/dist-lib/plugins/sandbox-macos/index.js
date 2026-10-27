import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
import { execEnv, HOMEBREW_BIN_DIRS } from '../../lib/helpers/spawn-path.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { Policy } from '../../lib/policy/index.js';
import { createShellAdapter } from '../../lib/tools/exec/adapters/shell/shell-adapter.js';
import { runCommand, startCommand } from '../../lib/tools/exec/runner.js';
import { canonicalDenyRoots } from '../../lib/tools/fs/scope.js';
const ON_OFF = { files: 'paths', network: 'on-off', env: true };
const HOSTS = { ...ON_OFF, network: 'hosts' };
const PROXY_VARS = [
    'http_proxy',
    'HTTP_PROXY',
    'https_proxy',
    'HTTPS_PROXY',
    'all_proxy',
    'ALL_PROXY'
];
const NO_PROXY_VARS = ['no_proxy', 'NO_PROXY'];
const NO_POLICY = "the seatbelt shell needs the run's compiled policy";
const REFUSED = 65;
const WHOLE_OUTPUT = 1 << 24;
const DENY_ALL = ['(version 1)', '(deny default)'];
const BASE = [
    '(allow process-exec process-fork)',
    '(allow signal (target same-sandbox))',
    '(allow process-info* (target same-sandbox))',
    '(allow sysctl-read)',
    '(allow user-preference-read)',
    '(allow ipc-posix-sem ipc-posix-shm-read-data)',
    '(allow pseudo-tty)',
    '(allow mach-lookup (global-name "com.apple.system.opendirectoryd.libinfo")' +
        ' (global-name "com.apple.sysmond") (global-name "com.apple.system.logger"))',
    '(allow file-ioctl (literal "/dev/null") (literal "/dev/tty"))'
];
const READ_ALL = '(allow file-read*)';
const SYSTEM_READS = [
    '/usr',
    '/System',
    '/bin',
    '/sbin',
    '/private/etc',
    '/dev',
    '/private/var/db/timezone',
    '/private/var/select',
    ...HOMEBREW_BIN_DIRS.map((dir) => path.dirname(dir))
];
const ROOT_LINKS = '(literal "/var") (literal "/etc") (literal "/tmp")';
const XCODE_SELECT = '/private/var/db/xcode_select_link';
const COMMAND_LINE_TOOLS = '/Library/Developer/CommandLineTools';
const XCRUN_DB = 'xcrun_db';
const XCODE_PLIST = '/Library/Preferences/com.apple.dt.Xcode.plist';
const DEVICES = '(literal "/dev/null") (literal "/dev/tty") (subpath "/dev/fd")';
const LOOPBACK = '(remote ip "localhost:*")';
const NETWORK = [
    '(allow network* system-socket)',
    '(allow mach-lookup (global-name "com.apple.dnssd.service")' +
        ' (global-name "com.apple.SystemConfiguration.DNSConfiguration")' +
        ' (global-name "com.apple.SystemConfiguration.configd")' +
        ' (global-name "com.apple.trustd.agent") (global-name "com.apple.networkd"))'
];
async function scratch() {
    const base = await fs.promises.realpath(os.tmpdir());
    return fs.promises.mkdtemp(path.join(base, 'qvac-seatbelt-'));
}
function removeDir(dir) {
    return fs.promises.rm(dir, { recursive: true, force: true });
}
export class SeatbeltSandbox {
    name = 'sandbox-macos';
    api = PluginRegistry.API_VERSION;
    provides = ['sandbox'];
    wants = ['egress-proxy'];
    addons = { 'bare-subprocess': () => import('bare-subprocess') };
    shell;
    _sandboxExec;
    _writable;
    _denied = [];
    _proxy = () => undefined;
    _userTemp = null;
    constructor({ sandboxExec = '/usr/bin/sandbox-exec', writable = [] } = {}) {
        this._sandboxExec = sandboxExec;
        this._writable = writable;
        const enforcement = () => this.enforces;
        this.shell = {
            name: 'seatbelt',
            get enforces() {
                return enforcement();
            },
            resolve: (args, ctx) => ({
                run: async (execution) => {
                    const policy = this._admit(ctx?.policy);
                    const tmp = await this._scratch();
                    let session = null;
                    try {
                        session = await this._session(policy);
                        const runtime = await this._runtime(policy, tmp, session?.port);
                        const shell = createShellAdapter({
                            name: 'seatbelt',
                            loadRuntime: () => Promise.resolve(runtime),
                            downloadNote: ''
                        });
                        const result = SeatbeltSandbox._confined(await shell.resolve(args).run(execution));
                        return SeatbeltSandbox._refused(result, session?.denied() ?? []);
                    }
                    finally {
                        await session?.close();
                        await removeDir(tmp);
                    }
                }
            })
        };
    }
    get enforces() {
        return this._proxy() ? HOSTS : ON_OFF;
    }
    validate() {
        if (process.platform !== 'darwin') {
            return `Seatbelt runs on macOS only, not ${process.platform}`;
        }
        const relative = this._writable.find((folder) => !path.isAbsolute(folder));
        return relative === undefined ? null : `needs absolute writable folders, not ${relative}`;
    }
    async setup(ctx) {
        this._denied = ctx.deniedRoots;
        this._proxy = () => ctx.services['egress-proxy'];
        await Promise.all(this._writable.map((folder) => fs.promises.mkdir(folder, { recursive: true })));
        await this._probe();
        this._userTemp = await SeatbeltSandbox._darwinUserTemp();
        return { exec: { shell: this.shell }, services: { sandbox: this._service() } };
    }
    _service() {
        const enforcement = () => this.enforces;
        return {
            name: this.shell.name,
            isolated: false,
            get enforces() {
                return enforcement();
            },
            open: async (dir, policy) => this._workspace(dir, this._admit(policy))
        };
    }
    _session(policy) {
        const proxy = this._proxy();
        if (policy.network.mode !== 'hosts' || !proxy) {
            return null;
        }
        return proxy.open({ hosts: policy.network.hosts });
    }
    _admit(policy) {
        if (!policy) {
            throw new Error(NO_POLICY);
        }
        const refused = Policy.enforceable(policy, this);
        if (refused) {
            throw new Error(`${this.name} ${refused}`);
        }
        return Policy.withWrites(policy, this._writable);
    }
    async _workspace(dir, policy) {
        const tmp = await this._scratch();
        const session = await Promise.resolve(this._session(policy)).catch(async (error) => {
            await removeDir(tmp);
            throw error;
        });
        const writable = { ...policy, files: { ...policy.files, write: [dir, ...policy.files.write] } };
        const runtime = () => this._runtime(writable, tmp, session?.port);
        let reported = 0;
        return {
            exec: async (command, { cwd, env, timeoutMs, signal } = {}) => {
                const result = SeatbeltSandbox._confined(await runCommand(command, {
                    ...(await runtime()),
                    cwd,
                    env,
                    timeoutMs,
                    signal,
                    maxOutputChars: WHOLE_OUTPUT
                }));
                const denied = session?.denied() ?? [];
                const fresh = denied.slice(reported);
                reported = denied.length;
                return SeatbeltSandbox._refused(result, fresh);
            },
            start: async (command, { cwd } = {}) => startCommand(command, { ...(await runtime()), cwd }),
            close: async () => {
                await session?.close();
                await removeDir(tmp);
            }
        };
    }
    static profile(policy, { roots, reads = 0, parents = 0, denied = 0, ancestors = 0, sockets = 0, proxy }) {
        const subpaths = Array.from({ length: roots }, (_, i) => `(subpath (param "W${i}"))`);
        const deny = Array.from({ length: denied }, (_, i) => `(deny file-read* file-write* (subpath (param "D${i}")))`);
        const pinned = Array.from({ length: ancestors }, (_, i) => `(deny file-write-unlink (literal (param "A${i}")))`);
        return [
            ...DENY_ALL,
            ...SeatbeltSandbox._reads(policy, subpaths, { reads, parents }),
            ...BASE,
            `(allow file-write* ${DEVICES} (subpath (param "TMP")) ${subpaths.join(' ')})`,
            ...deny,
            ...pinned,
            ...SeatbeltSandbox._network(policy, sockets, proxy)
        ].join('\n');
    }
    static _reads(policy, writable, { reads, parents }) {
        if (policy.files.read === 'all') {
            return [READ_ALL];
        }
        const roots = Array.from({ length: reads }, (_, i) => `(subpath (param "R${i}"))`);
        const folders = Array.from({ length: parents }, (_, i) => `(literal (param "M${i}"))`);
        return [
            `(allow file-read* (literal "/") ${[...roots, ...writable].join(' ')} (subpath (param "TMP")))`,
            `(allow file-read-metadata ${[ROOT_LINKS, ...folders].join(' ')})`
        ];
    }
    static _network(policy, sockets, proxy) {
        if (policy.network.mode === 'on') {
            return NETWORK;
        }
        const allowed = Array.from({ length: sockets }, (_, i) => `(allow network-outbound (remote unix-socket (path-literal (param "S${i}"))))`);
        if (policy.network.localhost) {
            allowed.push(`(allow network-outbound ${LOOPBACK})`);
        }
        if (policy.network.bind) {
            allowed.push('(allow network-bind (local ip "localhost:*"))', '(allow network-inbound (local ip "localhost:*"))');
        }
        if (policy.network.mode === 'hosts' && proxy !== undefined) {
            allowed.push(`(allow network-outbound (remote ip "localhost:${proxy}"))`);
        }
        return allowed;
    }
    static _confined(result) {
        if (result.exitCode === REFUSED && result.stderr.startsWith('sandbox-exec:')) {
            throw new Error(`sandbox could not start: ${result.stderr.split('\n')[0]}`);
        }
        return result;
    }
    static _refused(result, denied) {
        if (denied.length === 0) {
            return result;
        }
        const note = `egress-proxy refused ${denied.join(', ')}: a line reaches only the policy's network.hosts, at public addresses`;
        const stderr = result.stderr && !result.stderr.endsWith('\n') ? `${result.stderr}\n` : result.stderr;
        return { ...result, stderr: `${stderr}${note}\n` };
    }
    async _runtime(policy, tmp, proxy) {
        const real = await Promise.all(policy.files.write.map((root) => fs.promises.realpath(root)));
        await fs.promises.access(this._sandboxExec, fs.constants.X_OK);
        const denied = [...new Set([...policy.files.deny, ...this._denied])];
        const sockets = policy.sockets === 'all' ? [] : policy.sockets;
        const ancestors = [...SeatbeltSandbox._ancestors(denied)];
        const reads = await SeatbeltSandbox._readRoots(policy);
        const parents = reads.length ? [...SeatbeltSandbox._ancestors([...reads, ...real, tmp])] : [];
        const profile = SeatbeltSandbox.profile(policy, {
            roots: real.length,
            reads: reads.length,
            parents: parents.length,
            denied: denied.length,
            ancestors: ancestors.length,
            sockets: sockets.length,
            proxy
        });
        const params = [
            ...reads.flatMap((root, i) => ['-D', `R${i}=${root}`]),
            ...parents.flatMap((folder, i) => ['-D', `M${i}=${folder}`]),
            ...real.flatMap((root, i) => ['-D', `W${i}=${root}`]),
            ...denied.flatMap((root, i) => ['-D', `D${i}=${root}`]),
            ...ancestors.flatMap((folder, i) => ['-D', `A${i}=${folder}`]),
            ...sockets.flatMap((socket, i) => ['-D', `S${i}=${socket}`])
        ];
        const inherited = SeatbeltSandbox._env(policy);
        const { spawn } = await import('child_process');
        const spawnArgv = spawn;
        const spawnFn = (line, opts = {}) => spawnArgv(this._sandboxExec, ['-p', profile, ...params, '-D', `TMP=${tmp}`, '/bin/sh', '-c', line], {
            ...opts,
            shell: false,
            env: SeatbeltSandbox._proxied({ ...inherited, ...opts.env, TMPDIR: `${tmp}/` }, proxy)
        });
        return { spawn: spawnFn, killProcess: process.kill.bind(process) };
    }
    static _proxied(env, proxy) {
        if (proxy === undefined) {
            return env;
        }
        const proxied = { ...env };
        for (const name of PROXY_VARS) {
            proxied[name] = `http://127.0.0.1:${proxy}`;
        }
        for (const name of NO_PROXY_VARS) {
            delete proxied[name];
        }
        return proxied;
    }
    static _env(policy) {
        const env = execEnv(process.env, process.platform);
        const kept = policy.env;
        if (kept === 'all') {
            return env;
        }
        return Object.fromEntries(Object.entries(env).filter(([name]) => kept.includes(name)));
    }
    static async _readRoots(policy) {
        if (policy.files.read === 'all') {
            return [];
        }
        const listed = await canonicalDenyRoots(policy.files.read, fs.promises.realpath);
        return [...new Set([...SYSTEM_READS, ...(await SeatbeltSandbox._developerDir()), ...listed])];
    }
    static async _developerDir() {
        const dir = await fs.promises.realpath(XCODE_SELECT).catch(() => COMMAND_LINE_TOOLS);
        const parts = dir.split('/');
        const bundle = parts.findIndex((part) => part.endsWith('.app'));
        if (bundle < 0) {
            return [dir];
        }
        return [parts.slice(0, bundle + 1).join('/'), XCODE_PLIST];
    }
    static _ancestors(paths) {
        const folders = new Set();
        for (const each of paths) {
            for (let at = path.dirname(each); !folders.has(at); at = path.dirname(at)) {
                folders.add(at);
            }
        }
        return folders;
    }
    async _scratch() {
        const tmp = await scratch();
        if (!this._userTemp) {
            return tmp;
        }
        try {
            await fs.promises.copyFile(path.join(this._userTemp, XCRUN_DB), path.join(tmp, XCRUN_DB));
        }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
                await removeDir(tmp);
                throw error;
            }
        }
        return tmp;
    }
    static async _darwinUserTemp() {
        const { spawn } = await import('child_process');
        const result = await runCommand('/usr/bin/getconf DARWIN_USER_TEMP_DIR', {
            spawn: spawn,
            killProcess: process.kill.bind(process),
            timeoutMs: 10_000
        });
        if (result.exitCode !== 0) {
            throw new Error(`getconf DARWIN_USER_TEMP_DIR failed: ${result.stderr.trim()}`);
        }
        return fs.promises.realpath(result.stdout.trim());
    }
    async _probe() {
        const tmp = await scratch();
        try {
            const runtime = await this._runtime(Policy.compile(undefined, { write: [tmp] }), tmp);
            const result = await runCommand('/usr/bin/true', { ...runtime, timeoutMs: 10_000 });
            if (result.exitCode !== 0) {
                throw new Error(`sandbox-exec refused the profile: ${result.stderr.trim()}`);
            }
        }
        finally {
            await removeDir(tmp);
        }
    }
}
