import b4a from 'b4a';
import { lookupHost } from '../../lib/dns-lookup.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { resolveOutboundUrl } from '../../lib/tools/url-guard.js';
PluginRegistry.requirePeers('egress-proxy', { 'bare-net': () => import.meta.resolve('net') });
const MAX_HEAD = 64 * 1024;
const HEAD_END = '\r\n\r\n';
const REASONS = {
    400: 'Bad Request',
    403: 'Forbidden',
    431: 'Request Header Fields Too Large',
    502: 'Bad Gateway'
};
const DROPPED = /^(host|connection|keep-alive|proxy-connection|proxy-authorization)\s*:/i;
export class EgressProxy {
    name = 'egress-proxy';
    api = PluginRegistry.API_VERSION;
    provides = ['egress-proxy'];
    addons = { 'bare-net': () => import('bare-net') };
    _resolveHost;
    _dial;
    _sessions = new Set();
    constructor({ resolveHost = lookupHost, dial } = {}) {
        this._resolveHost = resolveHost;
        this._dial = dial;
    }
    setup() {
        return {
            services: { 'egress-proxy': { open: (options) => this.open(options) } },
            teardown: async () => {
                await Promise.all([...this._sessions].map((session) => session.close()));
            }
        };
    }
    async open({ hosts, signal }) {
        const { default: net } = await import('net');
        const sockets = new Set();
        const served = {
            hosts,
            dial: this._dial ?? ((address, port) => net.connect(port, address)),
            denied: new Set(),
            track: (socket) => {
                sockets.add(socket);
                socket.on('close', () => sockets.delete(socket));
            }
        };
        const server = net.createServer((client) => {
            served.track(client);
            this._serve(client, served);
        });
        const port = await listen(server);
        let closing = null;
        const session = {
            port,
            denied: () => [...served.denied],
            close: () => {
                closing ??= new Promise((resolve) => {
                    for (const socket of sockets) {
                        socket.destroy();
                    }
                    server.close(() => resolve());
                }).then(() => {
                    this._sessions.delete(session);
                });
                return closing;
            }
        };
        this._sessions.add(session);
        signal?.addEventListener('abort', () => void session.close());
        return session;
    }
    _serve(client, served) {
        const chunks = [];
        client.on('error', () => client.destroy());
        const onData = (chunk) => {
            chunks.push(chunk);
            const buffered = b4a.concat(chunks);
            const end = b4a.indexOf(buffered, HEAD_END);
            if (end === -1) {
                if (buffered.byteLength > MAX_HEAD) {
                    client.removeListener('data', onData);
                    reply(client, 431, 'the request head is too large');
                }
                return;
            }
            client.pause();
            client.removeListener('data', onData);
            void this._forward(client, parseHead(buffered, end), served);
        };
        client.on('data', onData);
    }
    async _forward(client, request, served) {
        const tunnel = request.method.toUpperCase() === 'CONNECT';
        const url = parseTarget(tunnel ? `http://${request.target}` : request.target);
        if (!url || url.protocol !== 'http:' || (tunnel && url.pathname !== '/')) {
            reply(client, 400, 'the proxy takes CONNECT host:port or an absolute http:// URL');
            return;
        }
        const check = await resolveOutboundUrl(url, {
            resolveHost: this._resolveHost,
            hosts: served.hosts
        });
        if (check.blocked) {
            served.denied.add(url.hostname);
            reply(client, 403, `egress-proxy refused ${url.hostname}: ${check.blocked}`);
            return;
        }
        const address = check.addresses?.[0] ?? url.hostname.replace(/^\[(.*)\]$/, '$1');
        const upstream = served.dial(address, Number(url.port) || 80);
        served.track(upstream);
        const opening = tunnel ? null : originHead(request, url);
        splice(client, upstream, { opening, rest: request.rest, host: url.hostname });
    }
}
function parseHead(buffered, end) {
    const [line, ...fields] = b4a.toString(buffered.subarray(0, end), 'latin1').split('\r\n');
    const [method = '', target = '', version = 'HTTP/1.1'] = line.split(' ');
    return { method, target, version, fields, rest: buffered.subarray(end + HEAD_END.length) };
}
function splice(client, upstream, { opening, rest, host }) {
    let connected = false;
    upstream.on('error', () => {
        if (connected) {
            client.destroy();
        }
        else {
            reply(client, 502, `egress-proxy could not reach ${host}`);
        }
        upstream.destroy();
    });
    client.on('error', () => upstream.destroy());
    upstream.once('connect', () => {
        connected = true;
        if (opening === null) {
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        }
        else {
            upstream.write(opening);
        }
        if (rest.byteLength > 0) {
            upstream.write(rest);
        }
        client.pipe(upstream);
        upstream.pipe(client);
    });
}
async function listen(server) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    return typeof address === 'object' && address ? address.port : 0;
}
function parseTarget(target) {
    try {
        return new URL(target);
    }
    catch {
        return null;
    }
}
function originHead({ method, version, fields }, url) {
    const kept = fields.filter((field) => field !== '' && !DROPPED.test(field));
    return [
        `${method} ${url.pathname}${url.search} ${version}`,
        `Host: ${url.host}`,
        ...kept,
        'Connection: close',
        '',
        ''
    ].join('\r\n');
}
function reply(socket, status, reason) {
    const body = `${reason}\n`;
    socket.end([
        `HTTP/1.1 ${status} ${REASONS[status]}`,
        'Content-Type: text/plain',
        `Content-Length: ${b4a.byteLength(body)}`,
        'Connection: close',
        '',
        body
    ].join('\r\n'));
}
