import b4a from 'b4a';
import { errorMessage, isRecord } from '../guards.js';
const SCOPE = ['api'];
const MAX_STRING = 40;
export function instrument(handlers, log) {
    const out = { ...handlers };
    for (const [name, handler] of Object.entries(out)) {
        if (isHandler(handler)) {
            Object.assign(out, { [name]: wrap(name, handler, log) });
        }
    }
    return out;
}
function isHandler(value) {
    return typeof value === 'function';
}
function wrap(name, handler, log) {
    return function (...args) {
        const started = Date.now();
        const request = summarize(args[0]);
        let result;
        try {
            result = handler.apply(this, args);
        }
        catch (err) {
            logFailure(log, name, { request, started, err });
            throw err;
        }
        if (isStream(result)) {
            log?.debug(SCOPE, `${name} opened`, { request });
            return result;
        }
        if (isPromise(result)) {
            return result.then((value) => {
                log?.debug(SCOPE, name, { request, ms: Date.now() - started, ...count(value) });
                return value;
            }, (err) => {
                logFailure(log, name, { request, started, err });
                throw err;
            });
        }
        log?.debug(SCOPE, name, { request, ms: Date.now() - started, ...count(result) });
        return result;
    };
}
function logFailure(log, name, { request, started, err }) {
    log?.debug(SCOPE, `${name} failed`, {
        request,
        ms: Date.now() - started,
        err: errorMessage(err)
    });
}
function isPromise(value) {
    return isRecord(value) && typeof value.then === 'function';
}
function isStream(value) {
    return (isRecord(value) &&
        Symbol.asyncIterator in value &&
        typeof value[Symbol.asyncIterator] === 'function');
}
function count(value) {
    if (!isRecord(value))
        return null;
    for (const field of Object.values(value)) {
        if (Array.isArray(field)) {
            return { n: field.length };
        }
    }
    return null;
}
function summarize(request) {
    if (!isRecord(request))
        return '';
    return Object.entries(request)
        .map(([key, value]) => `${key}=${scalar(value)}`)
        .join(' ');
}
function scalar(value) {
    if (value === null || value === undefined) {
        return String(value);
    }
    if (b4a.isBuffer(value))
        return `<${value.byteLength}b>`;
    if (Array.isArray(value)) {
        return `[${value.length}]`;
    }
    if (typeof value === 'string') {
        return value.length > MAX_STRING ? `<str:${value.length}>` : value;
    }
    if (typeof value === 'object') {
        return '{}';
    }
    return String(value);
}
