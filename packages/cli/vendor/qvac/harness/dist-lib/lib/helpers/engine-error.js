import { HarnessError } from '../errors.js';
export class RecoveryRequired extends Error {
    operation;
    constructor(operation) {
        super(`The outcome of ${operation.name} (${operation.id}) is uncertain. Supply its result or explicitly authorize a retry.${operation.reason ? ` ${operation.reason}` : ''}`);
        this.operation = operation;
    }
}
export class HookHalt extends Error {
    code = 'hook-halt';
    hook;
    constructor(reason, hook) {
        super(reason);
        this.name = 'HookHalt';
        this.hook = hook;
    }
}
export class AbortedError extends HarnessError {
    constructor() {
        super('ABORTED');
    }
}
const CAUSE_DEPTH = 3;
function tagCause(error, depth) {
    if (depth <= 0 || error === undefined || error === null)
        return undefined;
    const object = typeof error === 'object' || typeof error === 'function' ? error : undefined;
    const ownMessage = object ? ownData(object, 'message') : undefined;
    let message;
    if (error instanceof Error) {
        message = error.message;
    }
    else if (typeof ownMessage === 'string') {
        message = ownMessage;
    }
    else {
        message = errorMessage(error);
    }
    let name = 'Error';
    if (error instanceof Error) {
        name = error.name;
    }
    else if (object && typeof ownData(object, 'name') === 'string') {
        name = ownData(object, 'name');
    }
    const code = object ? ownCode(object) : undefined;
    const stack = error instanceof Error ? error.stack : undefined;
    const cause = object ? tagCause(ownData(object, 'cause'), depth - 1) : undefined;
    const taggedCause = { message, name };
    if (code) {
        taggedCause.code = code;
    }
    if (stack) {
        taggedCause.stack = stack;
    }
    if (cause) {
        taggedCause.cause = cause;
    }
    return taggedCause;
}
function ownData(object, key) {
    try {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor && 'value' in descriptor ? descriptor.value : undefined;
    }
    catch {
        return undefined;
    }
}
function jsonClone(value) {
    const active = new Set();
    const clone = (current) => {
        if (current === null ||
            typeof current === 'string' ||
            typeof current === 'boolean' ||
            (typeof current === 'number' && Number.isFinite(current))) {
            return current;
        }
        if (typeof current !== 'object')
            throw new TypeError('Not JSON data');
        if (active.has(current))
            throw new TypeError('Circular JSON data');
        active.add(current);
        try {
            if (Array.isArray(current)) {
                const result = [];
                for (let index = 0; index < current.length; index++) {
                    const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
                    result.push(descriptor && 'value' in descriptor ? clone(descriptor.value) : null);
                }
                return result;
            }
            const prototype = Object.getPrototypeOf(current);
            if (prototype !== Object.prototype && prototype !== null) {
                throw new TypeError('Not a plain JSON object');
            }
            const result = {};
            for (const key of Object.keys(current)) {
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                if (!descriptor || !('value' in descriptor)) {
                    throw new TypeError('Not JSON data');
                }
                Object.defineProperty(result, key, {
                    value: clone(descriptor.value),
                    enumerable: true,
                    configurable: true,
                    writable: true
                });
            }
            return result;
        }
        finally {
            active.delete(current);
        }
    };
    return clone(value);
}
function normalizeOperation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    let argsDescriptor;
    try {
        argsDescriptor = Object.getOwnPropertyDescriptor(value, 'args');
    }
    catch {
        return undefined;
    }
    const id = ownData(value, 'id');
    const name = ownData(value, 'name');
    const effect = ownData(value, 'effect');
    const args = ownData(value, 'args');
    if (typeof id !== 'string' ||
        typeof name !== 'string' ||
        (effect !== 'read' && effect !== 'write') ||
        !argsDescriptor ||
        !('value' in argsDescriptor)) {
        return undefined;
    }
    try {
        const reason = ownData(value, 'reason');
        const operation = {
            id,
            name,
            args: jsonClone(args),
            effect
        };
        if (typeof reason === 'string') {
            operation.reason = reason;
        }
        return operation;
    }
    catch {
        return undefined;
    }
}
function normalizeTaggedEngineError(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const tag = ownData(value, 'tag');
    const message = ownData(value, 'message');
    const name = ownData(value, 'name');
    const stack = ownData(value, 'stack');
    if (typeof message !== 'string' || typeof name !== 'string') {
        return undefined;
    }
    if (tag === 'aborted') {
        const aborted = { tag, message, name };
        if (typeof stack === 'string') {
            aborted.stack = stack;
        }
        return aborted;
    }
    if (tag === 'failed') {
        const code = ownData(value, 'code');
        const cause = ownData(value, 'cause');
        const taggedCause = tagCause(cause, CAUSE_DEPTH);
        const failed = {
            tag,
            message,
            name
        };
        if (typeof code === 'string') {
            failed.code = code;
        }
        if (typeof stack === 'string') {
            failed.stack = stack;
        }
        if (taggedCause) {
            failed.cause = taggedCause;
        }
        return failed;
    }
    if (tag === 'recovery') {
        const operation = normalizeOperation(ownData(value, 'operation'));
        if (!operation) {
            return undefined;
        }
        const recovery = {
            tag,
            message,
            name,
            operation
        };
        if (typeof stack === 'string') {
            recovery.stack = stack;
        }
        return recovery;
    }
    return undefined;
}
export function tagError(error) {
    const tagged = normalizeTaggedEngineError(error);
    if (tagged) {
        return tagged;
    }
    const object = error && (typeof error === 'object' || typeof error === 'function') ? error : undefined;
    const ownMessage = object ? ownData(object, 'message') : undefined;
    let message;
    if (error instanceof Error) {
        message = error.message;
    }
    else if (typeof ownMessage === 'string') {
        message = ownMessage;
    }
    else {
        message = errorMessage(error);
    }
    let name = 'Error';
    if (error instanceof Error) {
        name = error.name;
    }
    else if (object && typeof ownData(object, 'name') === 'string') {
        name = ownData(object, 'name');
    }
    const stack = error instanceof Error ? error.stack : undefined;
    if (error instanceof RecoveryRequired) {
        const operation = normalizeOperation(error.operation);
        if (operation) {
            const recovery = {
                tag: 'recovery',
                message,
                name,
                operation
            };
            if (stack) {
                recovery.stack = stack;
            }
            return recovery;
        }
    }
    if (error instanceof AbortedError) {
        const aborted = { tag: 'aborted', message, name };
        if (stack) {
            aborted.stack = stack;
        }
        return aborted;
    }
    const code = object ? ownCode(object) : undefined;
    const cause = object ? tagCause(ownData(object, 'cause'), CAUSE_DEPTH) : undefined;
    const failed = {
        tag: 'failed',
        message,
        name
    };
    if (code) {
        failed.code = code;
    }
    if (stack) {
        failed.stack = stack;
    }
    if (cause) {
        failed.cause = cause;
    }
    return failed;
}
export function rehydrateError(value, fallbackMessage = 'Completion failed') {
    if (!value) {
        return new Error(fallbackMessage);
    }
    const normalized = normalizeTaggedEngineError(value) ?? tagError(value);
    if (normalized.tag === 'recovery') {
        const error = new RecoveryRequired(normalized.operation);
        error.message = normalized.message || fallbackMessage;
        error.name = normalized.name || error.name;
        if (normalized.stack) {
            error.stack = normalized.stack;
        }
        return error;
    }
    if (normalized.tag === 'aborted') {
        const error = new AbortedError();
        error.message = normalized.message || fallbackMessage;
        error.name = normalized.name || error.name;
        if (normalized.stack) {
            error.stack = normalized.stack;
        }
        return error;
    }
    const options = {};
    if (normalized.cause) {
        options.cause = rehydrateCause(normalized.cause);
    }
    const error = new Error(normalized.message || fallbackMessage, options);
    error.name = normalized.name || 'Error';
    if (normalized.code) {
        Object.assign(error, { code: normalized.code });
    }
    if (normalized.stack) {
        error.stack = normalized.stack;
    }
    return error;
}
function rehydrateCause(value, depth = CAUSE_DEPTH) {
    const cause = value.cause && depth > 1 ? rehydrateCause(value.cause, depth - 1) : undefined;
    const error = new Error(value.message, cause ? { cause } : undefined);
    error.name = value.name;
    if (value.code) {
        Object.assign(error, { code: value.code });
    }
    if (value.stack) {
        error.stack = value.stack;
    }
    return error;
}
function ownCode(object) {
    const code = ownData(object, 'code');
    if (typeof code === 'string') {
        return code;
    }
    return typeof code === 'number' && Number.isFinite(code) ? String(code) : undefined;
}
function errorMessage(value) {
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object') {
        const message = ownData(value, 'message');
        if (typeof message === 'string') {
            return message;
        }
    }
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        }
        catch {
            return '[object with circular references]';
        }
    }
    return String(value);
}
