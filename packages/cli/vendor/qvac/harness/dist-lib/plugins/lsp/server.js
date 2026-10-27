import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import { errorMessage, isRecord } from '../../lib/guards.js';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { spawnEnv } from '../../lib/helpers/spawn-path.js';
import { RpcConnection } from './rpc.js';
const STOP_GRACE_MS = 1_000;
export const spawnServer = (command, args, { cwd, env }) => spawn('/bin/sh', ['-c', 'exec "$0" "$@"', command, ...args], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
});
const CLIENT_CAPABILITIES = {
    textDocument: {
        definition: { linkSupport: true },
        references: {},
        hover: { contentFormat: ['plaintext', 'markdown'] },
        documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        diagnostic: {},
        publishDiagnostics: {}
    },
    workspace: { symbol: {}, workspaceFolders: true }
};
export class LanguageServer {
    config;
    root;
    exited;
    capabilities = {};
    _child;
    _rpc;
    _open = new Map();
    _waiters = new Map();
    _markExited;
    _failure = null;
    constructor(config, root, spawnFn = spawnServer) {
        this.config = config;
        this.root = root;
        let markExited = noop;
        this.exited = new Promise((resolve) => (markExited = resolve));
        this._markExited = markExited;
        this._rpc = new RpcConnection((bytes) => this._child.stdin?.write(bytes), (method, params) => this._onNotification(method, params));
        this._child = this._spawn(spawnFn);
    }
    async initialize() {
        const uri = pathToFileURL(this.root).href;
        const result = await this.request('initialize', {
            processId: process.pid,
            rootUri: uri,
            workspaceFolders: [{ uri, name: path.basename(this.root) }],
            capabilities: CLIENT_CAPABILITIES,
            initializationOptions: this.config.initializationOptions
        });
        if (isRecord(result) && isRecord(result.capabilities)) {
            this.capabilities = result.capabilities;
        }
        this.notify('initialized', {});
    }
    request(method, params, options) {
        return this._rpc.request(method, params, options);
    }
    notify(method, params) {
        this._rpc.notify(method, params);
    }
    async withDocument(uri, text, use) {
        const count = this._open.get(uri) ?? 0;
        this._open.set(uri, count + 1);
        if (count === 0) {
            const textDocument = { uri, languageId: this.config.language, version: 1, text };
            this.notify('textDocument/didOpen', { textDocument });
        }
        try {
            return await use();
        }
        finally {
            const left = (this._open.get(uri) ?? 1) - 1;
            if (left > 0) {
                this._open.set(uri, left);
            }
            else {
                this._open.delete(uri);
                this.notify('textDocument/didClose', { textDocument: { uri } });
            }
        }
    }
    nextDiagnostics(uri, waitMs, signal) {
        if (this._failure) {
            return Promise.reject(this._failure);
        }
        if (signal?.aborted) {
            return Promise.reject(new AbortedError());
        }
        return new Promise((resolve, reject) => {
            const waiters = this._waiters.get(uri) ?? new Set();
            this._waiters.set(uri, waiters);
            const done = (diagnostics, error) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                waiters.delete(done);
                if (waiters.size === 0) {
                    this._waiters.delete(uri);
                }
                if (error) {
                    reject(error);
                }
                else {
                    resolve(diagnostics);
                }
            };
            const onAbort = () => done(null, new AbortedError());
            const timer = setTimeout(() => done(null), waitMs);
            signal?.addEventListener('abort', onAbort, { once: true });
            waiters.add(done);
        });
    }
    async stop() {
        if (this._failure)
            return;
        await this.request('shutdown', undefined, { timeoutMs: STOP_GRACE_MS }).catch(noop);
        this.notify('exit');
        if (!(await this._exitWithin(STOP_GRACE_MS))) {
            this._child.kill('SIGKILL');
        }
        await this.exited;
    }
    _spawn(spawnFn) {
        const { command, args = [] } = this.config;
        const child = spawnFn(command, args, {
            cwd: this.root,
            env: spawnEnv(process.env, process.platform)
        });
        child.on('error', (error) => this._fail(`could not start: ${errorMessage(error)}`));
        child.on('exit', (code) => this._fail(exitReason(command, code)));
        child.stdin?.on('error', noop);
        child.stderr?.on('data', noop);
        child.stdout?.on('data', (chunk) => this._receive(chunk));
        return child;
    }
    _receive(chunk) {
        try {
            this._rpc.receive(chunk);
        }
        catch (error) {
            this._rpc.close(new Error(`the ${this.config.language} language server: ${errorMessage(error)}`));
            this._child.kill('SIGKILL');
        }
    }
    _fail(reason) {
        if (this._failure)
            return;
        this._failure = new Error(`the ${this.config.language} language server ${reason}`);
        this._rpc.close(this._failure);
        for (const waiter of [...this._waiters.values()].flatMap((set) => [...set])) {
            waiter(null, this._failure);
        }
        this._markExited();
    }
    async _exitWithin(ms) {
        let timer;
        const late = new Promise((resolve) => (timer = setTimeout(() => resolve(false), ms)));
        const exited = await Promise.race([this.exited.then(() => true), late]);
        clearTimeout(timer);
        return exited;
    }
    _onNotification(method, params) {
        if (method !== 'textDocument/publishDiagnostics' || !isRecord(params)) {
            return;
        }
        const uri = typeof params.uri === 'string' ? params.uri : '';
        for (const waiter of [...(this._waiters.get(uri) ?? [])]) {
            waiter(params.diagnostics);
        }
    }
}
function exitReason(command, code) {
    if (code !== 126 && code !== 127) {
        return `exited (code ${code})`;
    }
    let what = 'is not executable';
    try {
        if (fs.statSync(command).isDirectory()) {
            what = 'is a directory';
        }
    }
    catch {
        what = 'was not found';
    }
    return `could not start: ${command} ${what}`;
}
function noop() { }
