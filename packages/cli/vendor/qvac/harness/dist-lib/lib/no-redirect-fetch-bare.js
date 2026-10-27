import http, { Agent as HttpAgent } from 'bare-http1';
import https, { Agent as HttpsAgent } from 'bare-https';
import * as bareDns from 'bare-dns';
import { HarnessError } from './errors.js';
import { isPrivateOrBlocked } from './tools/private-ip.js';
import { makeValidatingLookup } from './validating-lookup.js';
import { runNoRedirectFetch } from './no-redirect-fetch-impl.js';
export class BlockedHostError extends Error {
    code = 'EBLOCKEDHOST';
    constructor(host) {
        super(`Connection to "${host}" is blocked (private/loopback/metadata).`);
        this.name = 'BlockedHostError';
    }
}
function isLiteralIp(host) {
    if (host.includes(':')) {
        return true;
    }
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
export function makeValidatingAgent(Agent, lookup) {
    const agent = new Agent({ keepAlive: 1000, timeout: 5000, lookup });
    const original = agent.createConnection.bind(agent);
    agent.createConnection = (opts) => {
        const host = opts.host;
        if (typeof host === 'string' && isLiteralIp(host) && isPrivateOrBlocked(host)) {
            throw new BlockedHostError(host);
        }
        return original(opts);
    };
    return agent;
}
const rawAllLookup = (hostname, opts, cb) => {
    bareDns.lookup(hostname, opts, cb);
};
const validatingLookup = makeValidatingLookup(rawAllLookup);
const httpAgent = makeValidatingAgent(HttpAgent, validatingLookup);
const httpsAgent = makeValidatingAgent(HttpsAgent, validatingLookup);
export function noRedirectFetch(url, init = {}) {
    const request = (target, opts, onresponse) => {
        const common = { method: readMethod(opts.method), headers: opts.headers };
        const forward = (res) => onresponse(res);
        return target.protocol === 'https:'
            ? https.request(target.href, { ...common, agent: httpsAgent }, forward)
            : http.request(target.href, { ...common, agent: httpAgent }, forward);
    };
    return runNoRedirectFetch(request, url, init);
}
function readMethod(method) {
    if (method === 'GET' ||
        method === 'POST' ||
        method === 'PUT' ||
        method === 'DELETE' ||
        method === 'PATCH' ||
        method === 'HEAD' ||
        method === 'OPTIONS') {
        return method;
    }
    throw new HarnessError('UNSUPPORTED_HTTP_METHOD', [method]);
}
