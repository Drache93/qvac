var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { generateRandomRequestId } from '../runtime/request-id.js';
import { createDisposableScope } from '../runtime/disposable-scope.js';
import { privateEndpoint, throwIfAborted } from './network.js';
export function createRpcServerManager(deps) {
    const servers = new Map();
    const starts = new Set();
    let closing;
    async function stop(serverId) {
        const entry = servers.get(serverId);
        if (!entry)
            throw new Error(`Unknown RPC server: ${serverId}`);
        if (entry.stopping)
            return entry.stopping;
        entry.stopping = (async () => {
            const errors = [];
            if (entry.withdraw) {
                try {
                    await entry.withdraw();
                    delete entry.withdraw;
                }
                catch (error) {
                    errors.push(error);
                }
            }
            try {
                await entry.handle.stop();
            }
            catch (error) {
                errors.push(error);
            }
            if (errors.length === 1)
                throw errors[0];
            if (errors.length > 1) {
                throw new AggregateError(errors, `Failed to stop RPC server ${serverId}: ${errors.map(String).join('; ')}`, { cause: errors[0] });
            }
            servers.delete(serverId);
        })();
        try {
            await entry.stopping;
        }
        finally {
            delete entry.stopping;
        }
    }
    async function startOwned(options, ctx) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            throwIfAborted(ctx.signal);
            if (options.discoveryTopic &&
                (!options.allowNonLoopbackHost || !privateEndpoint(`${options.host}:1`))) {
                throw new Error('RPC advertising requires a concrete private IPv4 host and allowNonLoopbackHost: true');
            }
            const scope = __addDisposableResource(env_1, createDisposableScope(), true);
            const handle = await deps.start(options);
            const serverId = generateRandomRequestId();
            const entry = { handle, active: false };
            servers.set(serverId, entry);
            let transferred = false;
            scope.defer(async () => {
                if (!transferred)
                    await stop(serverId);
            });
            throwIfAborted(ctx.signal);
            await deps.ready(handle, ctx);
            throwIfAborted(ctx.signal);
            if (closing)
                throw new Error('RPC server manager is closing');
            if (options.discoveryTopic) {
                entry.withdraw = await deps.advertise(options.discoveryTopic, handle.url);
            }
            throwIfAborted(ctx.signal);
            if (closing)
                throw new Error('RPC server manager is closing');
            entry.active = true;
            transferred = true;
            return { serverId, url: handle.url, rdmaCapable: handle.rdmaCapable };
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            const result_1 = __disposeResources(env_1);
            if (result_1)
                await result_1;
        }
    }
    function start(options, ctx) {
        if (closing)
            return Promise.reject(new Error('RPC server manager is closing'));
        const task = startOwned(options, ctx);
        starts.add(task);
        void task.then(() => starts.delete(task), () => starts.delete(task));
        return task;
    }
    function close() {
        if (closing)
            return closing;
        closing = (async () => {
            // Start every known stop before waiting for starts that may be rolling back.
            const initialIds = new Set([...servers].filter(([, entry]) => entry.active).map(([id]) => id));
            const stopping = Promise.allSettled([...initialIds].map(stop));
            await Promise.allSettled([...starts]);
            const lateStops = Promise.allSettled([...servers.keys()].filter((id) => !initialIds.has(id)).map(stop));
            const results = [...(await stopping), ...(await lateStops)];
            const errors = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
            if (errors.length)
                throw new AggregateError(errors, 'Failed to stop owned RPC servers');
        })();
        return closing.finally(() => {
            closing = undefined;
        });
    }
    return {
        start,
        stop,
        close,
        get size() {
            return servers.size;
        }
    };
}
