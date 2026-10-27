import net from 'bare-net';
import { createHash } from 'bare-crypto';
import { InferenceCancelledError } from '../errors/index.js';
export function rpcTopic(topic) {
    return createHash('sha-256').update('qvac:ggml-rpc-discovery:v1\0').update(topic).digest();
}
// Native servers currently accept IPv4 only. Do not resolve announced hostnames.
export function privateEndpoint(url) {
    const match = /^(\d+\.\d+\.\d+\.\d+):([1-9]\d{0,4})$/.exec(url);
    if (!match)
        return;
    const host = match[1];
    const octets = host.split('.').map(Number);
    if (host.split('.').some((part, i) => String(octets[i]) !== part || octets[i] > 255))
        return;
    const [a, b] = octets;
    if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)))
        return;
    const port = Number(match[2]);
    if (port > 65535)
        return;
    return { host, port };
}
export function throwIfAborted(signal) {
    if (signal.aborted)
        throw new InferenceCancelledError('rpc');
}
export function delay(ms, signal) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(), ms);
        const abort = () => finish(new InferenceCancelledError('rpc'));
        function finish(error) {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            if (error)
                reject(error);
            else
                resolve();
        }
        signal.addEventListener('abort', abort, { once: true });
    });
}
export function probeTcp(host, port, timeoutMs, signal, scope) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const timer = setTimeout(() => finish(false), timeoutMs);
        const abort = () => finish(false, new InferenceCancelledError('rpc'));
        let finished = false;
        function finish(reachable, error) {
            if (finished)
                return;
            finished = true;
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            socket.destroy();
            if (error)
                reject(error);
            else
                resolve(reachable);
        }
        signal.addEventListener('abort', abort, { once: true });
        scope?.defer(() => finish(false));
        socket.on('error', () => finish(false));
        socket.on('close', () => finish(false));
        socket.on('connect', () => finish(true));
        try {
            socket.connect(port, host);
        }
        catch {
            finish(false);
        }
    });
}
export async function waitForReady(host, port, signal) {
    const deadline = Date.now() + 10000;
    const probeHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    while (Date.now() < deadline) {
        if (await probeTcp(probeHost, port, Math.min(250, deadline - Date.now()), signal))
            return;
        await delay(Math.min(50, Math.max(0, deadline - Date.now())), signal);
    }
    throw new Error(`RPC server readiness timed out at ${host}:${port}`);
}
