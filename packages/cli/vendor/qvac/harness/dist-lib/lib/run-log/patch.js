import { isRecord } from '../guards.js';
export { isRecord };
export function diff(prev, next) {
    if (prev === next)
        return undefined;
    if (Array.isArray(prev) && Array.isArray(next)) {
        let kept = 0;
        while (kept < prev.length && kept < next.length && same(prev[kept], next[kept])) {
            kept++;
        }
        if (kept === prev.length && kept === next.length) {
            return undefined;
        }
        return { t: kept, a: next.slice(kept) };
    }
    if (isRecord(prev) && !Array.isArray(prev) && isRecord(next) && !Array.isArray(next)) {
        const o = Object.create(null);
        const d = [];
        let changed = false;
        for (const key of Object.keys(next)) {
            if (next[key] === undefined)
                continue;
            const patch = Object.hasOwn(prev, key) && prev[key] !== undefined
                ? diff(prev[key], next[key])
                : { $: next[key] };
            if (patch) {
                o[key] = patch;
                changed = true;
            }
        }
        for (const key of Object.keys(prev)) {
            if (prev[key] !== undefined && (!Object.hasOwn(next, key) || next[key] === undefined)) {
                d.push(key);
                changed = true;
            }
        }
        if (!changed) {
            return undefined;
        }
        return d.length ? { o, d } : { o };
    }
    return { $: next };
}
function same(prev, next) {
    return prev === next || diff(prev, next) === undefined;
}
function isReplacementPatch(patch) {
    return Object.hasOwn(patch, '$');
}
function isArrayPatch(patch) {
    return Object.hasOwn(patch, 't');
}
function isObjectPatch(patch) {
    return Object.hasOwn(patch, 'o');
}
export function apply(base, patch) {
    if (isReplacementPatch(patch)) {
        return patch.$;
    }
    if (isArrayPatch(patch)) {
        const arrayPatch = patch;
        const array = Array.isArray(base) ? base : [];
        array.length = Math.min(array.length, arrayPatch.t);
        for (const value of arrayPatch.a) {
            array.push(value);
        }
        return array;
    }
    if (!isObjectPatch(patch)) {
        throw new TypeError('Invalid JSON patch');
    }
    const objectPatch = patch;
    const record = isRecord(base) && !Array.isArray(base) ? base : {};
    for (const key of objectPatch.d ?? []) {
        if (Object.hasOwn(record, key)) {
            delete record[key];
        }
    }
    for (const key of Object.keys(objectPatch.o)) {
        const child = objectPatch.o[key];
        if (child === undefined) {
            continue;
        }
        const value = apply(Object.hasOwn(record, key) ? record[key] : undefined, child);
        Object.defineProperty(record, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
    return record;
}
