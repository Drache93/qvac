import { errorMessage, isRecord } from './guards.js';
import { HarnessLog } from './log.js';
function readValue(value, key) {
    if (value === null)
        return undefined;
    if (typeof value !== 'object' && typeof value !== 'function')
        return undefined;
    return Reflect.get(value, key);
}
function readString(value, key) {
    const found = readValue(value, key);
    return typeof found === 'string' ? found : null;
}
function readCandidates(err) {
    const found = readValue(err, 'candidates');
    if (!Array.isArray(found)) {
        return undefined;
    }
    return found.map((candidate) => readString(candidate, 'href') ?? String(candidate));
}
export function resolutionDetail(err) {
    const detail = {};
    const code = readString(err, 'code');
    if (code !== null) {
        detail.code = code;
    }
    const specifier = readString(err, 'specifier');
    if (specifier !== null) {
        detail.specifier = specifier;
    }
    const referrer = readString(readValue(err, 'referrer'), 'href');
    if (referrer !== null) {
        detail.referrer = referrer;
    }
    const candidates = readCandidates(err);
    if (candidates !== undefined) {
        detail.candidates = candidates;
    }
    return detail;
}
function readCache(meta) {
    const cache = readValue(meta, 'cache');
    return isRecord(cache) ? cache : null;
}
export function isReferrerLost(referrer, parent, cache) {
    if (referrer !== null && referrer !== undefined)
        return false;
    if (cache === null)
        return false;
    return Reflect.get(cache, parent) !== undefined;
}
export function resolutionFailure(specifier, parent, err) {
    return {
        specifier,
        parent,
        ...resolutionDetail(err),
        err: errorMessage(err)
    };
}
let uninstall = null;
export function installResolutionDetector(meta) {
    const cacheRecord = readCache(meta);
    if (cacheRecord === null) {
        return noop;
    }
    if (uninstall !== null) {
        return noop;
    }
    const self = Reflect.get(cacheRecord, meta.url);
    const Module = readValue(self, 'constructor');
    if (typeof Module !== 'function') {
        return noop;
    }
    const resolve = readValue(Module, 'resolve');
    if (typeof resolve !== 'function') {
        return noop;
    }
    const startedAt = Date.now();
    const original = resolve.bind(Module);
    const wrapped = (specifier, parentURL, opts = {}) => {
        const parent = String(parentURL);
        if (isReferrerLost(opts.referrer, parent, cacheRecord)) {
            HarnessLog.warn('diag referrer LOST', {
                specifier,
                parent,
                modules: Object.keys(cacheRecord).length,
                aliveSec: Math.round((Date.now() - startedAt) / 1000)
            });
        }
        try {
            return original(specifier, parentURL, opts);
        }
        catch (err) {
            if (isReferrerLost(opts.referrer, parent, cacheRecord)) {
                HarnessLog.error('diag resolve FAILED after a lost referrer', resolutionFailure(specifier, parent, err));
            }
            throw err;
        }
    };
    Reflect.set(Module, 'resolve', wrapped);
    uninstall = () => {
        Reflect.set(Module, 'resolve', resolve);
        uninstall = null;
    };
    return uninstall;
}
export function uninstallResolutionDetector() {
    uninstall?.();
}
function noop() { }
