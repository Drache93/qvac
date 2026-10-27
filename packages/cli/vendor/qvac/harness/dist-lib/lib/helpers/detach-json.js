export function detachJson(value) {
    const detached = detachValue(value);
    return detached;
}
function detachValue(value) {
    if (!isStructuralJson(value, new WeakSet())) {
        const encoded = JSON.stringify(value);
        if (encoded === undefined) {
            return undefined;
        }
        return JSON.parse(encoded);
    }
    return cloneStructural(value, { arrayItem: false });
}
function isStructuralJson(value, ancestors) {
    if (isJsonPrimitive(value)) {
        return true;
    }
    if (typeof value !== 'object') {
        return false;
    }
    if (ancestors.has(value) || hasJsonHook(value)) {
        return false;
    }
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            return isStructuralArray(value, ancestors);
        }
        if (!isPlainRecord(value)) {
            return false;
        }
        return isStructuralRecord(value, ancestors);
    }
    finally {
        ancestors.delete(value);
    }
}
function isJsonPrimitive(value) {
    return (value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number');
}
function isStructuralArray(value, ancestors) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
        return false;
    }
    for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) {
            if (index in value) {
                return false;
            }
            continue;
        }
        if (!('value' in descriptor)) {
            return false;
        }
        if (!isStructuralJson(descriptor.value, ancestors)) {
            return false;
        }
    }
    return true;
}
function isStructuralRecord(value, ancestors) {
    for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            return false;
        }
        if (!isStructuralJson(descriptor.value, ancestors)) {
            return false;
        }
    }
    return true;
}
function cloneStructural(value, position) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return null;
        }
        return Object.is(value, -0) ? 0 : value;
    }
    if (value === undefined) {
        if (position.arrayItem) {
            return null;
        }
        return undefined;
    }
    if (Array.isArray(value)) {
        return cloneArray(value);
    }
    if (!isPlainRecord(value)) {
        throw new TypeError('Expected a plain JSON object');
    }
    return cloneRecord(value);
}
function cloneArray(value) {
    const output = [];
    for (let index = 0; index < value.length; index++) {
        output.push(cloneStructural(value[index], { arrayItem: true }));
    }
    return output;
}
function cloneRecord(value) {
    const output = {};
    for (const key of Object.keys(value)) {
        const child = cloneStructural(value[key], { arrayItem: false });
        if (child !== undefined) {
            Object.defineProperty(output, key, {
                value: child,
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
    }
    return output;
}
function isPlainRecord(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function hasJsonHook(value) {
    const own = Object.getOwnPropertyDescriptor(value, 'toJSON');
    if (own) {
        return !('value' in own) || typeof own.value === 'function';
    }
    let prototype = Object.getPrototypeOf(value);
    while (prototype) {
        const inherited = Object.getOwnPropertyDescriptor(prototype, 'toJSON');
        if (inherited) {
            return !('value' in inherited) || typeof inherited.value === 'function';
        }
        prototype = Object.getPrototypeOf(prototype);
    }
    return false;
}
