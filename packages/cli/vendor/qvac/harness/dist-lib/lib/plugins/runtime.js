import { createContext } from './context.js';
import { Scope } from './scope.js';
export class PluginRuntime {
    ctx;
    _plugins;
    _root;
    _scopes = new Map();
    _opening = null;
    _closing = null;
    _disposing = null;
    constructor(plugins = []) {
        this._plugins = [...plugins];
        this._root = new Scope('root');
        this.ctx = createContext(this._root);
    }
    ready() {
        if (this._closing) {
            return Promise.reject(new Error('Plugin runtime is closing or closed'));
        }
        this._root.seal();
        this._opening ??= Promise.resolve().then(() => this._open());
        return this._opening;
    }
    close() {
        this._root.seal();
        this._closing ??= Promise.resolve().then(() => this._close());
        return this._closing;
    }
    async add(plugin) {
        if (!this._opening) {
            throw new Error('Plugin runtime has not started');
        }
        await this._opening;
        this._assertStarting();
        if (this._scopes.has(plugin.name)) {
            throw new Error(`Duplicate plugin "${plugin.name}"`);
        }
        try {
            await this._setup(plugin);
        }
        catch (error) {
            const scope = this._scopes.get(plugin.name);
            this._scopes.delete(plugin.name);
            try {
                await scope?.close();
            }
            catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Plugin startup and cleanup failed', {
                    cause: error
                });
            }
            throw error;
        }
    }
    async remove(name) {
        const scope = this._scopes.get(name);
        if (!scope) {
            throw new Error(`No plugin "${name}"`);
        }
        this._scopes.delete(name);
        await scope.close();
    }
    async _open() {
        try {
            this._checkNames();
            for (const plugin of this._plugins) {
                this._assertStarting();
                await this._setup(plugin);
            }
            this._assertStarting();
        }
        catch (error) {
            try {
                await this._dispose();
            }
            catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Plugin startup and cleanup failed', {
                    cause: error
                });
            }
            throw error;
        }
    }
    _checkNames() {
        const names = new Set();
        for (const plugin of this._plugins) {
            if (names.has(plugin.name)) {
                throw new Error(`Duplicate plugin "${plugin.name}"`);
            }
            names.add(plugin.name);
        }
    }
    _assertStarting() {
        if (this._closing) {
            throw new Error('Plugin runtime closed during startup');
        }
    }
    async _setup(plugin) {
        const scope = new Scope(plugin.name);
        this._scopes.set(plugin.name, scope);
        try {
            for (const name of plugin.requires ?? []) {
                this.ctx.get(name);
            }
            await plugin.setup(createContext(scope, this.ctx));
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Plugin "${plugin.name}" failed to start: ${reason}`, {
                cause: error
            });
        }
        finally {
            scope.seal();
        }
    }
    async _close() {
        await this._opening?.catch(noop);
        await this._dispose();
    }
    _dispose() {
        this._disposing ??= Promise.resolve().then(() => this._disposeScopes());
        return this._disposing;
    }
    async _disposeScopes() {
        const errors = [];
        const scopes = [...this._scopes.values()].reverse();
        scopes.push(this._root);
        for (const scope of scopes) {
            try {
                await scope.close();
            }
            catch (error) {
                errors.push(error);
            }
        }
        this._scopes.clear();
        if (errors.length) {
            throw new AggregateError(errors, 'Plugin cleanup failed');
        }
    }
}
function noop() { }
