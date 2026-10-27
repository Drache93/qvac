import { isRecord } from '../guards.js';
import { stableStringify } from './stable-stringify.js';
export function toolDeniedResult(message) {
    return { error: message, denied: true };
}
export function failureResultRef(key, round, callId) {
    return `failure:${stableStringify([key, round, callId])}`;
}
export function failureResultReference(ref, callId) {
    return { type: 'qvac-failure-result-ref', ref, callId };
}
const MIN_COMPACTED_LENGTH = 37;
export function isCompactedLength(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= MIN_COMPACTED_LENGTH;
}
export function isFailureResultReference(entry) {
    if (!isRecord(entry) || Array.isArray(entry)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(entry);
    if (prototype !== Object.prototype && prototype !== null) {
        return false;
    }
    const keys = Reflect.ownKeys(entry).length;
    return (Object.hasOwn(entry, 'type') &&
        entry.type === 'qvac-failure-result-ref' &&
        Object.hasOwn(entry, 'ref') &&
        typeof entry.ref === 'string' &&
        Object.hasOwn(entry, 'callId') &&
        typeof entry.callId === 'string' &&
        (keys === 3 ||
            (keys === 4 && Object.hasOwn(entry, 'compactedTo') && isCompactedLength(entry.compactedTo))));
}
export function storeFailureResult(value) {
    return value === undefined ? { undefined: true } : { value };
}
export function readFailureResult(value) {
    return 'undefined' in value ? undefined : value.value;
}
