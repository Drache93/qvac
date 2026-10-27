import { AbortedError, raceAbort } from '../helpers/race-abort.js';
import { Policy } from '../policy/index.js';
import { isPrivateOrBlocked, stripIPv6Brackets } from './private-ip.js';
const LITERAL_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
export function checkOutboundHost(url) {
    const host = stripIPv6Brackets(url.hostname);
    return isPrivateOrBlocked(host)
        ? `blocked host: ${host} (private, loopback, link-local or metadata address)`
        : null;
}
function unlisted(url, hosts) {
    return hosts && !Policy.allowsHost(hosts, url.hostname)
        ? `host ${url.hostname} is not in the policy's network.hosts`
        : null;
}
export async function resolveOutboundUrl(url, { resolveHost, signal, hosts } = {}) {
    const blocked = unlisted(url, hosts) ?? checkOutboundHost(url);
    if (blocked) {
        return { blocked };
    }
    const host = stripIPv6Brackets(url.hostname);
    if (host.includes(':') || LITERAL_IPV4.test(host)) {
        return { blocked: null };
    }
    if (!resolveHost) {
        return { blocked: null };
    }
    let addresses;
    try {
        addresses = await raceAbort(resolveHost(host), signal);
    }
    catch (err) {
        if (err instanceof AbortedError) {
            throw err;
        }
        return { blocked: `could not resolve host: ${host}` };
    }
    if (addresses.length === 0) {
        return { blocked: `could not resolve host: ${host}` };
    }
    for (const address of addresses) {
        if (isPrivateOrBlocked(address)) {
            return { blocked: `blocked host: ${host} resolves to ${address}` };
        }
    }
    return { blocked: null, addresses };
}
