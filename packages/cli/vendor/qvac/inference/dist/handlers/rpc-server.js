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
import { getRequestRegistry } from '../runtime/request-context.js';
import { generateRandomRequestId } from '../runtime/request-id.js';
import { rpcServers } from '../rpc/instance.js';
import { discoverRpcEndpoints } from '../rpc/discovery.js';
import { clearRpcServerProvider } from '../rpc/provider.js';
import { RpcServerOperationError, InferenceCancelledError, RequestIdConflictError } from '../errors/index.js';
const requests = new Map();
let closing;
async function run(operation, work) {
    if (closing)
        throw new RpcServerOperationError(operation, 'Engine is closing');
    try {
        return await work();
    }
    catch (error) {
        if (error instanceof InferenceCancelledError ||
            error instanceof RpcServerOperationError ||
            error instanceof RequestIdConflictError) {
            throw error;
        }
        throw new RpcServerOperationError(operation, error instanceof Error ? error.message : String(error), error);
    }
}
async function withContext(kind, requestId, work) {
    const task = (async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const ctx = __addDisposableResource(env_1, await getRequestRegistry().begin({ requestId, kind }), true);
            return await work(ctx);
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
    })();
    requests.set(task, requestId);
    try {
        return await task;
    }
    catch (error) {
        if (error instanceof InferenceCancelledError) {
            throw new InferenceCancelledError(requestId, error.partial, error);
        }
        throw error;
    }
    finally {
        requests.delete(task);
    }
}
export async function handleStartRpcServer(request) {
    return run('startRpcServer', () => withContext('rpcServer', request.requestId ?? generateRandomRequestId(), async (ctx) => ({
        type: 'startRpcServer',
        ...(await rpcServers.start(request, ctx))
    })));
}
export async function handleStopRpcServer(request) {
    return run('stopRpcServer', async () => {
        await rpcServers.stop(request.serverId);
        return { type: 'stopRpcServer' };
    });
}
export async function handleDiscoverRpcServers(request) {
    return run('discoverRpcServers', () => withContext('rpcDiscovery', request.requestId ?? generateRandomRequestId(), async (ctx) => ({
        type: 'discoverRpcServers',
        servers: await discoverRpcEndpoints(request.topic, request.timeoutMs ?? 5000, ctx)
    })));
}
export function closeRpcResources() {
    if (closing)
        return closing;
    closing = (async () => {
        for (const requestId of requests.values())
            getRequestRegistry().cancel({ requestId });
        const stopping = rpcServers.close();
        const results = await Promise.allSettled([stopping, ...requests.keys()]);
        const stopResult = results[0];
        if (stopResult.status === 'rejected')
            throw stopResult.reason;
        clearRpcServerProvider();
    })();
    return closing.finally(() => {
        closing = undefined;
    });
}
