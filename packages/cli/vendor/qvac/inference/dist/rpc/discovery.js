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
import Hyperswarm from 'hyperswarm';
import { Buffer } from 'bare-buffer';
import { createDisposableScope } from '../runtime/disposable-scope.js';
import { registerSwarm, unregisterSwarm } from '../runtime/runtime-lifecycle.js';
import { getEngineLogger } from '../logging/index.js';
import { delay, privateEndpoint, rpcTopic, throwIfAborted } from './network.js';
import { queryRpcInventory } from './inventory.js';
const FRAME_LIMIT = 1024;
const LEASE_MS = 3000;
const MAX_CANDIDATES = 64;
export function createDiscoverySwarm() {
    const swarm = new Hyperswarm({ maxPeers: 32 });
    swarm.on('error', (error) => getEngineLogger().warn('RPC discovery swarm:', error));
    registerSwarm(swarm, { label: 'rpc-discovery', createdAt: Date.now() });
    return swarm;
}
export async function destroyDiscoverySwarm(swarm) {
    await swarm.destroy();
    unregisterSwarm(swarm);
}
export function parseAnnouncement(line) {
    if (line.length > FRAME_LIMIT)
        return;
    try {
        const value = JSON.parse(line);
        if (!value || typeof value !== 'object')
            return;
        const frame = value;
        if (frame['version'] !== 1 || typeof frame['url'] !== 'string')
            return;
        return privateEndpoint(frame['url']) ? frame['url'] : undefined;
    }
    catch {
        return;
    }
}
export async function advertiseRpcServer(topic, url, createSwarm = createDiscoverySwarm) {
    if (!privateEndpoint(url)) {
        throw new Error('RPC advertising requires a concrete private IPv4 endpoint');
    }
    const swarm = createSwarm();
    let withdrawn = false;
    const connections = new Set();
    const frame = JSON.stringify({ version: 1, url }) + '\n';
    const announce = () => {
        if (swarm.suspended)
            return;
        for (const connection of connections) {
            if (!connection.destroyed && !connection.write(frame))
                connection.destroy();
        }
    };
    swarm.on('connection', (connection) => {
        if (withdrawn || swarm.suspended) {
            connection.destroy();
            return;
        }
        connection.on('error', () => { });
        connection.once('close', () => connections.delete(connection));
        // This protocol is one-way; clients never send requests to advertisers.
        connection.on('data', () => connection.destroy());
        connections.add(connection);
        if (!connection.write(frame))
            connection.destroy();
    });
    const timer = setInterval(announce, 1000);
    async function withdraw() {
        withdrawn = true;
        clearInterval(timer);
        for (const connection of connections)
            connection.destroy();
        await destroyDiscoverySwarm(swarm);
    }
    try {
        swarm.join(rpcTopic(topic), { server: true, client: false });
    }
    catch (error) {
        await withdraw();
        throw error;
    }
    return withdraw;
}
export async function discoverRpcEndpoints(topic, timeoutMs, ctx, deps = {}) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const scope = __addDisposableResource(env_1, createDisposableScope(), true);
        const swarm = (deps.createSwarm ?? createDiscoverySwarm)();
        scope.defer(() => destroyDiscoverySwarm(swarm));
        const candidates = new Map();
        const inventories = new Map();
        const probes = new Map();
        const deadline = Date.now() + timeoutMs;
        const connections = new Set();
        scope.defer(() => {
            for (const connection of connections)
                connection.destroy();
        });
        swarm.on('connection', (connection) => {
            if (connections.size >= MAX_CANDIDATES) {
                connection.destroy();
                return;
            }
            connections.add(connection);
            let pending = Buffer.alloc(0);
            let frames = 0;
            connection.on('error', () => { });
            connection.once('close', () => {
                candidates.delete(connection);
                connections.delete(connection);
            });
            connection.on('data', (chunk) => {
                if (Date.now() >= deadline || ctx.signal.aborted || swarm.suspended)
                    return;
                if (pending.length + chunk.length > FRAME_LIMIT) {
                    connection.destroy();
                    return;
                }
                pending = Buffer.concat([pending, chunk]);
                let newline;
                while ((newline = pending.indexOf('\n')) !== -1) {
                    // Bound work from a peer that ignores the one-second announcement interval.
                    if (++frames > Math.ceil(timeoutMs / 1000) + 4) {
                        connection.destroy();
                        return;
                    }
                    const url = parseAnnouncement(pending.subarray(0, newline).toString());
                    pending = Buffer.from(pending.subarray(newline + 1));
                    if (!url) {
                        connection.destroy();
                        return;
                    }
                    const previous = candidates.get(connection);
                    if (previous && previous.url !== url) {
                        connection.destroy();
                        return;
                    }
                    candidates.set(connection, { url, seen: Date.now() });
                    if (probes.has(url) || probes.size >= MAX_CANDIDATES)
                        continue;
                    const endpoint = privateEndpoint(url);
                    const probe = (deps.probe ?? queryRpcInventory)(endpoint.host, endpoint.port, Math.max(1, Math.min(500, deadline - Date.now())), ctx.signal, scope)
                        .then((inventory) => {
                        if (inventory?.devices.length)
                            inventories.set(url, inventory);
                    })
                        .catch(() => { });
                    probes.set(url, probe);
                }
            });
        });
        swarm.join(rpcTopic(topic), { server: false, client: true });
        await delay(timeoutMs, ctx.signal);
        throwIfAborted(ctx.signal);
        // No cache survives the lookup. Closed peers and expired leases are excluded.
        if (swarm.suspended)
            return [];
        const now = Date.now();
        return [
            ...new Set([...candidates.values()]
                .filter(({ url, seen }) => now - seen < LEASE_MS && inventories.has(url))
                .map(({ url }) => url))
        ].map((url) => ({ url, ...inventories.get(url) }));
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
