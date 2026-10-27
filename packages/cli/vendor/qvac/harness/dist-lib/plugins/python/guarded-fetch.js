import { createGuardedFetch as createCoreFetch } from '../../lib/guarded-fetch.js';
import { Policy } from '../../lib/policy/index.js';
import { hostIsNamed } from './named-hosts.js';
const GUARDED = Symbol.for('qvac.harness.guardedFetch');
let policy = null;
const granted = new Set();
export function setConnectPolicy(next) {
    policy = next;
    granted.clear();
}
async function mayConnect(host) {
    if (policy?.allowed && !Policy.allowsHost(policy.allowed, host)) {
        return false;
    }
    if (!policy?.named || granted.has(host) || hostIsNamed(host, policy.named)) {
        return true;
    }
    const allowed = await policy.ask(host);
    if (allowed) {
        granted.add(host);
    }
    return allowed;
}
export function isGuardedFetch(fetch) {
    return typeof fetch === 'function' && GUARDED in fetch && fetch[GUARDED] === true;
}
export function createGuardedFetch(options = {}) {
    const guardedFetch = createCoreFetch({ ...options, mayConnect });
    const fetch = (input, init) => {
        const response = guardedFetch(input, init);
        response.catch(noop);
        return response;
    };
    return Object.assign(fetch, { [GUARDED]: true });
}
function noop() { }
