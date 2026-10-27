import { isRecord } from './patch.js';
import { stableStringify } from '../helpers/stable-stringify.js';
import { isCompactedLength } from '../helpers/failure-result.js';
const marker = '$qvacHistory';
const failureResultType = 'qvac-failure-result-ref';
const baseIndexCache = new WeakMap();
const exactBaseIndexCache = new WeakMap();
const compactHistoryCache = new WeakMap();
const frozenHistoryCache = new WeakMap();
const materializedCache = new WeakMap();
const materializedValueCache = new WeakMap();
const messageKeyCache = new WeakMap();
const deepFrozenCache = new WeakMap();
const validatedHistoryCache = new WeakMap();
const idlessBaseCache = new WeakMap();
const MATERIALIZED_HISTORY_CACHE_LIMIT = 16;
export function requestMessages(request) {
    if (!isRecord(request) || !Array.isArray(request.messages))
        return undefined;
    for (const message of request.messages) {
        if (hasFailureResultType(message) && !isRoleContentMessage(message)) {
            throw new Error('Request message uses the reserved failure-result reference type');
        }
    }
    return withoutHostIds(request.messages);
}
function withoutHostIds(messages) {
    if (!messages.some((message) => isRecord(message) && Object.hasOwn(message, 'id'))) {
        return messages;
    }
    const cached = idlessBaseCache.get(messages);
    if (cached) {
        return cached;
    }
    const frozen = Object.isFrozen(messages);
    const idless = messages.map((message) => {
        if (!isRecord(message) || !Object.hasOwn(message, 'id'))
            return message;
        const { id: _id, ...rest } = message;
        return frozen ? Object.freeze(rest) : rest;
    });
    idlessBaseCache.set(messages, frozen ? Object.freeze(idless) : idless);
    return idless;
}
export function compactRequestHistory(messages, base) {
    if (!base?.length || !messages.length)
        return messages;
    const indexes = exactBaseIndexes(base);
    let references = 0;
    const items = messages.map((message) => {
        const index = indexes.get(JSON.stringify(message));
        if (index === undefined) {
            return { inline: message };
        }
        references++;
        return { index };
    });
    return references === 0
        ? messages
        : { [marker]: { version: 1, base: 'request.messages', items } };
}
export function materializeRequestHistory(value, base) {
    if (Array.isArray(value))
        return value;
    if (!isHistoryReference(value)) {
        throw new Error('Malformed request history');
    }
    return materializeHistory(value, base);
}
export function validateRequestHistory(value, base) {
    validateHistoryList(value, base, new Set());
}
function exactBaseIndexes(base) {
    const cached = exactBaseIndexCache.get(base);
    if (cached) {
        return cached;
    }
    const indexes = new Map();
    base.forEach((message, index) => {
        if (isFailureResultReference(message))
            return;
        const key = JSON.stringify(message);
        if (!indexes.has(key)) {
            indexes.set(key, index);
        }
    });
    if (isDeepFrozen(base)) {
        exactBaseIndexCache.set(base, indexes);
    }
    return indexes;
}
export function compactSnapshotHistory(snapshot, base, previous) {
    if (!isRecord(snapshot) ||
        !isRecord(snapshot.context) ||
        !Array.isArray(snapshot.context.history)) {
        return snapshot;
    }
    const refs = snapshotFailureResultRefs(snapshot);
    const prior = isRecord(previous) && isRecord(previous.context) && Array.isArray(previous.context.history)
        ? previous.context.history
        : undefined;
    const history = compactHistory(snapshot.context.history, base, {
        failureRefs: refs,
        previous: prior
    });
    if (history === snapshot.context.history) {
        return snapshot;
    }
    return replacePath(snapshot, ['context', 'history'], history);
}
export function materializeSnapshotHistory(snapshot, base) {
    if (!isRecord(snapshot) || !isRecord(snapshot.context))
        return snapshot;
    const history = snapshot.context.history;
    if (!isHistoryReference(history)) {
        return snapshot;
    }
    const refs = snapshotFailureResultRefs(snapshot);
    const full = materializeHistory(history, base, refs);
    return replacePath(snapshot, ['context', 'history'], full);
}
export function compactMachineEvent(event, base) {
    if (!isRecord(event) || typeof event.type !== 'string' || !isRecord(event.output)) {
        return event;
    }
    const paths = eventHistoryPaths(completedActorName(event.type));
    let compacted = event;
    for (const path of paths) {
        compacted = mapPath(compacted, path, (value) => compactSplice(value, base));
    }
    return compacted;
}
export function materializeMachineEvent(event, base) {
    if (!isRecord(event) || typeof event.type !== 'string' || !isRecord(event.output)) {
        return event;
    }
    const paths = eventHistoryPaths(completedActorName(event.type));
    let materialized = event;
    for (const path of paths) {
        materialized = mapPath(materialized, path, (value) => materializeSplice(value, base));
    }
    return materialized;
}
export function validateSnapshotHistory(snapshot, base, options = {}) {
    const validateMachineContext = options.validateMachineContext ?? true;
    if (!isRecord(snapshot) || !isRecord(snapshot.context)) {
        return;
    }
    const refs = validateMachineContext ? snapshotFailureResultRefs(snapshot) : undefined;
    const referenced = new Set();
    if (Object.hasOwn(snapshot.context, 'history')) {
        for (const ref of validateHistoryList(snapshot.context.history, base, refs)) {
            referenced.add(ref);
        }
    }
    if (!validateMachineContext) {
        return;
    }
    if (isRecord(snapshot.context.failedCalls) && !Array.isArray(snapshot.context.failedCalls)) {
        for (const value of Object.values(snapshot.context.failedCalls)) {
            if (isRecord(value) && typeof value.resultRef === 'string') {
                referenced.add(value.resultRef);
            }
        }
    }
    if (isRecord(snapshot.context.rejectedCall)) {
        const rejectedCall = snapshot.context.rejectedCall;
        if (Object.hasOwn(rejectedCall, 'resultRef')) {
            if (typeof rejectedCall.resultRef !== 'string' || !refs?.has(rejectedCall.resultRef)) {
                throw new Error('Rejected call points outside the canonical failure result table');
            }
            referenced.add(rejectedCall.resultRef);
        }
    }
    if (refs) {
        for (const ref of refs) {
            if (!referenced.has(ref)) {
                throw new Error('Canonical failure result is not referenced by machine context');
            }
        }
    }
}
export function snapshotFailureResultRefs(snapshot) {
    if (!isRecord(snapshot) || !isRecord(snapshot.context)) {
        return new Set();
    }
    const { context } = snapshot;
    const refs = new Set();
    if (Object.hasOwn(context, 'failureResults')) {
        if (!isRecord(context.failureResults) || Array.isArray(context.failureResults)) {
            throw new Error('Malformed failure result table');
        }
        for (const key of Object.keys(context.failureResults)) {
            const item = context.failureResults[key];
            if (!key || !validFailureResult(item)) {
                throw new Error('Malformed canonical failure result');
            }
            refs.add(key);
        }
    }
    if (Object.hasOwn(context, 'failedCalls')) {
        if (!isRecord(context.failedCalls) || Array.isArray(context.failedCalls)) {
            throw new Error('Malformed failed-call table');
        }
        for (const value of Object.values(context.failedCalls)) {
            if (!isRecord(value)) {
                throw new Error('Failed call points outside the canonical failure result table');
            }
            if (typeof value.resultRef !== 'string' ||
                !refs.has(value.resultRef) ||
                !isRecord(value.outcome) ||
                typeof value.outcome.kind !== 'string') {
                throw new Error('Failed call points outside the canonical failure result table');
            }
        }
    }
    return refs;
}
export function validateMachineEventHistory(event, base, failureRefs) {
    if (!isRecord(event) || typeof event.type !== 'string' || !isRecord(event.output)) {
        return;
    }
    const paths = eventHistoryPaths(completedActorName(event.type));
    for (const path of paths) {
        const value = getPath(event, path);
        if (value === undefined || value === null) {
            continue;
        }
        if (!isRecord(value) ||
            typeof value.at !== 'number' ||
            !Number.isSafeInteger(value.at) ||
            value.at < 0) {
            throw new Error('Malformed history splice in machine event');
        }
        validateHistoryList(value.messages, base, failureRefs);
    }
    const actor = completedActorName(event.type);
    if (actor !== undefined && FAILURE_RESULT_OUTPUT_ACTORS.has(actor) && failureRefs !== undefined) {
        validateFailureOutput(event.output, failureRefs);
    }
}
export function foldMachineEventHistory(previous, patch, options) {
    const filtered = historyProjectionPatch(patch);
    if (!filtered) {
        return previous;
    }
    const projectedEvent = applyProjectionPatch(previous ?? {}, filtered);
    const next = mergeProjection(previous, projectedEvent);
    if (options.validate !== false) {
        validateHistoryProjection(next, options);
    }
    return freezeJson(next);
}
function applyProjectionPatch(base, patch) {
    if (isReplacementPatch(patch)) {
        return freezeJson(copyJson(patch.$));
    }
    if (isAppendPatch(patch)) {
        const array = Array.isArray(base) ? base.slice(0, Math.min(base.length, patch.t)) : [];
        return freezeJson(array.concat(copyJson(patch.a)));
    }
    const objectPatch = patch;
    const source = isRecord(base) ? base : Object.create(null);
    let result = source;
    for (const key of objectPatch.d ?? []) {
        if (Object.hasOwn(result, key)) {
            if (result === source) {
                result = cloneRecord(source);
            }
            delete result[key];
        }
    }
    for (const key of Object.keys(objectPatch.o)) {
        const child = objectPatch.o[key];
        if (!child) {
            continue;
        }
        const had = Object.hasOwn(result, key);
        const previous = had ? result[key] : undefined;
        const value = applyProjectionPatch(previous, child);
        if (had && value === previous) {
            continue;
        }
        if (result === source) {
            result = cloneRecord(source);
        }
        setOwn(result, key, value);
    }
    return result === source ? source : Object.freeze(result);
}
function compactSplice(value, base) {
    if (!isRecord(value) || !Array.isArray(value.messages))
        return value;
    const messages = compactHistory(value.messages, base);
    if (messages === value.messages) {
        return value;
    }
    return replaceOwn(value, 'messages', messages);
}
function materializeSplice(value, base) {
    if (!isRecord(value) || !isHistoryReference(value.messages))
        return value;
    return replaceOwn(value, 'messages', materializeHistory(value.messages, base));
}
function compactHistory(messages, base, scope = {}) {
    if (base?.length &&
        !isHistoryReference(messages) &&
        isDeepFrozen(base) &&
        isDeepFrozen(messages)) {
        return compactFrozenHistory(messages, base, scope);
    }
    validateHistoryList(messages, base, scope.failureRefs);
    if (!base?.length || isHistoryReference(messages)) {
        return messages;
    }
    const cacheable = isDeepFrozen(base);
    const cachedByBase = cacheable ? compactHistoryCache.get(messages) : undefined;
    const cached = cachedByBase?.get(base);
    const keys = new Array(messages.length);
    let matchesCached = cached !== undefined && cached.keys.length === messages.length;
    for (let index = 0; index < messages.length; index++) {
        const key = messageKey(messages[index]);
        keys[index] = key;
        if (matchesCached && cached && cached.keys[index] !== key) {
            matchesCached = false;
        }
    }
    if (matchesCached && cached) {
        return cached.value;
    }
    const indexes = indexBase(base);
    let references = 0;
    const items = messages.map((message, offset) => {
        const item = historyItem(message, keys[offset], indexes);
        if (!('inline' in item)) {
            references++;
        }
        return item;
    });
    const value = historyValue(messages, items, references);
    if (cacheable) {
        const memo = cachedByBase ?? new WeakMap();
        memo.set(base, { keys, value });
        if (!cachedByBase) {
            compactHistoryCache.set(messages, memo);
        }
    }
    return value;
}
function compactFrozenHistory(messages, base, { failureRefs, previous }) {
    const cachedByBase = frozenHistoryCache.get(messages);
    const cached = cachedByBase?.get(base);
    if (cached) {
        validateFailureReferenceSet(cached.failureRefs, failureRefs);
        return cached.value;
    }
    const prior = previous?.length && extendsHistory(messages, previous)
        ? frozenHistoryCache.get(previous)?.get(base)
        : undefined;
    const start = prior ? prior.items.length : 0;
    const items = prior ? prior.items.slice() : [];
    let references = prior ? prior.references : 0;
    const refs = prior
        ? appendedFailureRefs(prior.failureRefs, messages, start)
        : validateHistoryList(messages, base);
    validateFailureReferenceSet(refs, failureRefs);
    const indexes = indexBase(base);
    for (let index = start; index < messages.length; index++) {
        const item = historyItem(messages[index], messageKey(messages[index]), indexes);
        if (!('inline' in item)) {
            references++;
        }
        items.push(item);
    }
    const value = historyValue(messages, items, references);
    const memo = cachedByBase ?? new WeakMap();
    memo.set(base, { items, references, failureRefs: refs, value });
    if (!cachedByBase) {
        frozenHistoryCache.set(messages, memo);
    }
    return value;
}
function appendedFailureRefs(previous, messages, start) {
    const refs = new Set(previous);
    for (let index = start; index < messages.length; index++) {
        const ref = validateHistoryEntry(messages[index]);
        if (ref) {
            refs.add(ref);
        }
    }
    return [...refs];
}
function extendsHistory(messages, previous) {
    if (previous.length > messages.length)
        return false;
    for (let index = 0; index < previous.length; index++) {
        if (messages[index] !== previous[index])
            return false;
    }
    return true;
}
function historyItem(message, key, indexes) {
    if (isFailureResultReference(message)) {
        return { inline: message };
    }
    const indexedItem = indexes.get(key);
    if (indexedItem === undefined) {
        return { inline: message };
    }
    return typeof indexedItem === 'number' ? { index: indexedItem } : indexedItem;
}
function historyValue(messages, items, references) {
    return references === 0
        ? messages
        : { [marker]: { version: 1, base: 'request.messages', items } };
}
function indexBase(base) {
    const cacheable = isDeepFrozen(base);
    const cached = cacheable ? baseIndexCache.get(base) : undefined;
    if (cached) {
        return cached;
    }
    const indexes = new Map();
    for (let index = 0; index < base.length; index++) {
        if (isFailureResultReference(base[index])) {
            continue;
        }
        const key = messageKey(base[index]);
        if (!indexes.has(key)) {
            indexes.set(key, cacheable ? Object.freeze({ index }) : index);
        }
    }
    if (cacheable) {
        baseIndexCache.set(base, indexes);
    }
    return indexes;
}
function materializeHistory(value, base, failureRefs) {
    validateHistoryList(value, base, failureRefs);
    const cacheable = isDeepFrozen(value) && base !== undefined && isDeepFrozen(base);
    const perBase = cacheable ? materializedCache.get(value) : undefined;
    const cached = base && perBase ? perBase.get(base) : undefined;
    if (cached) {
        return cached;
    }
    if (!base) {
        throw new Error('History reference has no original request message base');
    }
    const signature = stableStringify(value);
    const byValue = cacheable ? materializedValueCache.get(base) : undefined;
    const bySignature = byValue?.get(signature);
    if (bySignature) {
        if (cacheable && byValue) {
            byValue.delete(signature);
            byValue.set(signature, bySignature);
            const memo = perBase ?? new WeakMap();
            memo.set(base, bySignature);
            if (!perBase) {
                materializedCache.set(value, memo);
            }
        }
        return bySignature;
    }
    const history = value[marker].items.map((item) => {
        if (isIndexedHistoryItem(item)) {
            const message = base[item.index];
            return isDeepFrozen(message) ? message : freezeJson(copyJson(message));
        }
        return freezeJson(copyJson(item.inline));
    });
    const result = Object.freeze(history);
    if (cacheable) {
        const memo = perBase ?? new WeakMap();
        memo.set(base, result);
        if (!perBase) {
            materializedCache.set(value, memo);
        }
    }
    if (cacheable) {
        const valueMemo = byValue ?? new Map();
        valueMemo.set(signature, result);
        if (valueMemo.size > MATERIALIZED_HISTORY_CACHE_LIMIT) {
            const oldest = valueMemo.keys().next().value;
            if (typeof oldest === 'string') {
                valueMemo.delete(oldest);
            }
        }
        if (!byValue) {
            materializedValueCache.set(base, valueMemo);
        }
    }
    return result;
}
function validateHistoryList(value, base, failureRefs) {
    const cacheable = isRecord(value) && isDeepFrozen(value) && (base === undefined || isDeepFrozen(base));
    const memo = cacheable ? validatedHistoryCache.get(value) : undefined;
    const cached = base ? memo?.byBase.get(base) : memo?.withoutBase;
    if (cached) {
        validateFailureReferenceSet(cached, failureRefs);
        return cached;
    }
    const result = collectHistoryFailureReferences(value, base);
    if (cacheable && isRecord(value)) {
        const entries = memo ?? { byBase: new WeakMap() };
        if (base) {
            entries.byBase.set(base, result);
        }
        else {
            entries.withoutBase = result;
        }
        if (!memo) {
            validatedHistoryCache.set(value, entries);
        }
    }
    validateFailureReferenceSet(result, failureRefs);
    return result;
}
function collectHistoryFailureReferences(value, base) {
    const references = new Set();
    if (Array.isArray(value)) {
        for (const item of value) {
            const ref = validateHistoryEntry(item);
            if (ref) {
                references.add(ref);
            }
        }
    }
    else if (isHistoryReference(value)) {
        for (const item of validateHistoryReference(value, base)) {
            const ref = validateHistoryReferenceItem(item, base);
            if (ref) {
                references.add(ref);
            }
        }
    }
    else if (isRecord(value) && Object.hasOwn(value, marker)) {
        throw new Error('Malformed history reference');
    }
    else {
        throw new Error('Machine history must be a message list or a validated reference');
    }
    return [...references];
}
function validateHistoryReference(value, base) {
    const keys = Object.keys(value);
    const reference = value[marker];
    if (keys.length !== 1 ||
        !isRecord(reference) ||
        Object.keys(reference).length !== 3 ||
        reference.version !== 1 ||
        reference.base !== 'request.messages' ||
        !Array.isArray(reference.items) ||
        !base) {
        throw new Error('Malformed history reference');
    }
    return reference.items;
}
function validateHistoryReferenceItem(item, base) {
    if (!isRecord(item)) {
        throw new Error('Malformed history reference item');
    }
    const itemKeys = Object.keys(item);
    if (itemKeys.length !== 1) {
        throw new Error('Malformed history reference item');
    }
    if ('index' in item) {
        const index = item.index;
        if (itemKeys[0] !== 'index' ||
            typeof index !== 'number' ||
            !Number.isSafeInteger(index) ||
            index < 0 ||
            !base ||
            index >= base.length) {
            throw new Error('History reference points outside the original request');
        }
        return undefined;
    }
    if (!isInlineHistoryItem(item)) {
        throw new Error('Malformed history reference item');
    }
    const inline = item.inline;
    if (itemKeys[0] !== 'inline' || !isRecord(inline)) {
        throw new Error('Malformed inline history message');
    }
    return validateHistoryEntry(inline);
}
function validateHistoryEntry(value) {
    if (!hasFailureResultType(value) || isRoleContentMessage(value)) {
        return undefined;
    }
    if (!isFailureResultReference(value)) {
        throw new Error('Malformed failure-result reference');
    }
    return value.ref;
}
function validateFailureReferenceSet(refs, failureRefs) {
    if (!failureRefs)
        return;
    for (const ref of refs) {
        if (!failureRefs.has(ref)) {
            throw new Error('History points outside the canonical failure result table');
        }
    }
}
function historyProjectionPatch(patch) {
    if (isReplacementPatch(patch)) {
        return { $: projectionFromEvent(patch.$) };
    }
    if (!isObjectPatch(patch))
        return undefined;
    const objectPatch = patch;
    const o = Object.create(null);
    if (Object.hasOwn(objectPatch.o, 'type')) {
        o.type = objectPatch.o.type;
    }
    const outputPatch = Object.hasOwn(objectPatch.o, 'output')
        ? outputHistoryPatch(objectPatch.o.output)
        : undefined;
    if (outputPatch) {
        o.output = outputPatch;
    }
    if (!Object.keys(o).length) {
        return undefined;
    }
    return { o };
}
function projectionFromEvent(event) {
    if (!isRecord(event))
        return {};
    const projection = Object.create(null);
    if (typeof event.type === 'string') {
        projection.type = event.type;
    }
    if (Object.hasOwn(event, 'output')) {
        projection.output = projectionFromOutput(event.output);
    }
    return projection;
}
function outputHistoryPatch(patch) {
    if (isReplacementPatch(patch)) {
        return { $: projectionFromOutput(patch.$) };
    }
    if (!isObjectPatch(patch))
        return undefined;
    const objectPatch = patch;
    const o = Object.create(null);
    const d = [];
    for (const key of ['history', 'preparation', 'step', 'failed']) {
        if (Object.hasOwn(objectPatch.o, key)) {
            const filtered = key === 'failed'
                ? failureOutputPatch(objectPatch.o[key])
                : outputHistoryChildPatch(key, objectPatch.o[key]);
            if (filtered) {
                o[key] = filtered;
            }
        }
        if (objectPatch.d?.includes(key)) {
            d.push(key);
        }
    }
    if (!Object.keys(o).length && !d.length) {
        return undefined;
    }
    return d.length ? { o, d } : { o };
}
function outputHistoryChildPatch(key, child) {
    if (!child)
        return undefined;
    if (key === 'history')
        return child;
    return slotHistoryPatch(child);
}
function slotHistoryPatch(patch) {
    if (isReplacementPatch(patch)) {
        return { $: slotProjection(patch.$) };
    }
    if (!isObjectPatch(patch))
        return undefined;
    const objectPatch = patch;
    const o = Object.create(null);
    if (Object.hasOwn(objectPatch.o, 'history')) {
        const child = objectPatch.o.history;
        if (child) {
            o.history = child;
        }
    }
    const d = objectPatch.d?.includes('history') ? ['history'] : [];
    if (!Object.keys(o).length && !d.length) {
        return undefined;
    }
    return d.length ? { o, d } : { o };
}
function projectionFromOutput(output) {
    if (!isRecord(output))
        return null;
    const result = Object.create(null);
    if (Object.hasOwn(output, 'history')) {
        result.history = output.history;
    }
    if (Object.hasOwn(output, 'failed')) {
        result.failed = projectFailureOutput(output.failed);
    }
    for (const key of ['preparation', 'step']) {
        if (!Object.hasOwn(output, key))
            continue;
        result[key] = slotProjection(output[key]);
    }
    return result;
}
function slotProjection(value) {
    if (!isRecord(value)) {
        return Object.create(null);
    }
    const result = Object.create(null);
    if (Object.hasOwn(value, 'history')) {
        result.history = value.history;
    }
    return result;
}
function mergeProjection(previous, event) {
    const before = isRecord(previous) ? previous : {};
    const next = isRecord(event) ? event : {};
    const result = cloneRecord(before);
    if (Object.hasOwn(next, 'type')) {
        setOwn(result, 'type', next.type);
    }
    if (Object.hasOwn(next, 'output')) {
        const oldOutput = before.output;
        const eventOutput = next.output;
        if (isRecord(oldOutput) && isRecord(eventOutput)) {
            const mergedOutput = cloneRecord(oldOutput);
            for (const key of Object.keys(eventOutput)) {
                setOwn(mergedOutput, key, eventOutput[key]);
            }
            setOwn(result, 'output', mergedOutput);
        }
        else {
            setOwn(result, 'output', eventOutput);
        }
    }
    return result;
}
export function validateHistoryProjection(value, options) {
    if (!isRecord(value) || !isRecord(value.output))
        return;
    const { base, failureRefs } = options;
    const actor = typeof value.type === 'string' ? completedActorName(value.type) : undefined;
    const output = value.output;
    if (failureRefs !== undefined && actor !== undefined && FAILURE_RESULT_OUTPUT_ACTORS.has(actor)) {
        validateFailureOutput(output, failureRefs);
    }
    if (actor === 'preparing') {
        for (const key of ['preparation', 'step']) {
            validateSlotHistoryProjection(output, key, { base, failureRefs });
        }
    }
    else if (actor !== undefined && HISTORY_OUTPUT_ACTORS.has(actor)) {
        if (Object.hasOwn(output, 'history')) {
            validateHistorySplice(output.history, { base, failureRefs });
        }
    }
}
function validateSlotHistoryProjection(output, key, options) {
    if (!Object.hasOwn(output, key))
        return;
    const slot = output[key];
    if (!isRecord(slot)) {
        throw new Error('Malformed history splice container');
    }
    if (Object.hasOwn(slot, 'history')) {
        validateHistorySplice(slot.history, options);
    }
}
function validateHistorySplice(value, options) {
    if (!isRecord(value) ||
        typeof value.at !== 'number' ||
        !Number.isSafeInteger(value.at) ||
        value.at < 0) {
        throw new Error('Malformed history splice in machine event');
    }
    validateHistoryList(value.messages, options.base, options.failureRefs);
}
function isHistoryReference(value) {
    return isRecord(value) && Object.hasOwn(value, marker);
}
function hasFailureResultType(value) {
    return isRecord(value) && value.type === failureResultType;
}
function projectFailureOutput(value) {
    if (!isRecord(value)) {
        return value;
    }
    const result = Object.create(null);
    if (Object.hasOwn(value, 'resultRef')) {
        result.resultRef = value.resultRef;
    }
    return result;
}
function failureOutputPatch(patch) {
    if (!patch) {
        return undefined;
    }
    if (isReplacementPatch(patch)) {
        return { $: projectFailureOutput(patch.$) };
    }
    if (!isObjectPatch(patch)) {
        return undefined;
    }
    const objectPatch = patch;
    const o = Object.create(null);
    if (Object.hasOwn(objectPatch.o, 'resultRef')) {
        const resultRef = objectPatch.o.resultRef;
        if (resultRef) {
            o.resultRef = resultRef;
        }
    }
    const d = objectPatch.d?.includes('resultRef') ? ['resultRef'] : [];
    if (!Object.keys(o).length && !d.length) {
        return undefined;
    }
    return d.length ? { o, d } : { o };
}
function validateFailureOutput(output, refs) {
    if (!Object.hasOwn(output, 'failed')) {
        return;
    }
    const failed = output.failed;
    if (!isRecord(failed) ||
        Object.keys(failed).length !== 1 ||
        typeof failed.resultRef !== 'string' ||
        failed.resultRef.length === 0 ||
        !refs.has(failed.resultRef)) {
        throw new Error('Failure output points outside the canonical failure result table');
    }
}
function isRoleContentMessage(value) {
    return isRecord(value) && typeof value.role === 'string' && Object.hasOwn(value, 'content');
}
function isFailureResultReference(value) {
    if (!isRecord(value) || !hasFailureResultType(value)) {
        return false;
    }
    const keys = Object.keys(value);
    const compacted = keys.length === 4 && keys.includes('compactedTo') && isCompactedLength(value.compactedTo);
    return ((keys.length === 3 || compacted) &&
        keys.includes('type') &&
        keys.includes('ref') &&
        keys.includes('callId') &&
        typeof value.ref === 'string' &&
        value.ref.length > 0 &&
        typeof value.callId === 'string' &&
        value.callId.length > 0);
}
function validFailureResult(value) {
    if (!isRecord(value) ||
        Array.isArray(value) ||
        Object.keys(value).length !== 2 ||
        typeof value.name !== 'string' ||
        value.name.length === 0 ||
        !isRecord(value.result)) {
        return false;
    }
    const resultKeys = Object.keys(value.result);
    return ((resultKeys.length === 1 && Object.hasOwn(value.result, 'value')) ||
        (resultKeys.length === 1 && value.result.undefined === true));
}
function isIndexedHistoryItem(item) {
    return Object.hasOwn(item, 'index');
}
function isInlineHistoryItem(item) {
    return Object.hasOwn(item, 'inline');
}
function isReplacementPatch(patch) {
    return Object.hasOwn(patch, '$');
}
function isAppendPatch(patch) {
    return Object.hasOwn(patch, 't');
}
function isObjectPatch(patch) {
    return isRecord(Reflect.get(patch, 'o'));
}
function completedActorName(type) {
    const prefix = 'xstate.done.actor.';
    if (!type.startsWith(prefix)) {
        return undefined;
    }
    return type.slice(type.lastIndexOf('.') + 1);
}
function messageKey(value) {
    if (value && typeof value === 'object') {
        const frozen = isDeepFrozen(value);
        const cached = messageKeyCache.get(value);
        if (frozen && cached) {
            return cached.key;
        }
        if (cached?.primitiveFields &&
            isRecord(value) &&
            hasSamePrimitiveFields(value, cached.primitiveFields)) {
            return cached.key;
        }
        const key = stableStringify(value);
        if (frozen) {
            messageKeyCache.set(value, { key });
        }
        else {
            const primitiveFields = getPrimitiveFields(value);
            if (primitiveFields) {
                messageKeyCache.set(value, { key, primitiveFields });
            }
        }
        return key;
    }
    return stableStringify(value);
}
function getPrimitiveFields(value) {
    if (!isRecord(value) || Array.isArray(value)) {
        return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return undefined;
    }
    const fields = [];
    for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            return undefined;
        }
        const field = descriptor.value;
        if (field !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof field)) {
            return undefined;
        }
        fields.push([key, field]);
    }
    return fields;
}
function hasSamePrimitiveFields(value, fields) {
    const keys = Object.keys(value);
    if (keys.length !== fields.length) {
        return false;
    }
    return fields.every(([key, field], index) => {
        if (keys[index] !== key)
            return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return Boolean(descriptor && 'value' in descriptor && Object.is(descriptor.value, field));
    });
}
const HISTORY_OUTPUT_ACTORS = new Set([
    'prepareRunning',
    'generating',
    'resolving',
    'rejecting',
    'executing',
    'batching',
    'wrapping',
    'retrieving'
]);
const FAILURE_RESULT_OUTPUT_ACTORS = new Set(['rejecting', 'executing']);
function eventHistoryPaths(actor) {
    if (actor === 'preparing') {
        return [
            ['output', 'preparation', 'history'],
            ['output', 'step', 'history']
        ];
    }
    if (actor !== undefined && HISTORY_OUTPUT_ACTORS.has(actor)) {
        return [['output', 'history']];
    }
    return [];
}
function getPath(value, path) {
    let current = value;
    for (const key of path) {
        if (!isRecord(current) || !Object.hasOwn(current, key))
            return undefined;
        current = current[key];
    }
    return current;
}
function mapPath(value, path, map) {
    const key = path[0];
    if (key === undefined || !isRecord(value) || !Object.hasOwn(value, key)) {
        return value;
    }
    const current = value[key];
    const updated = path.length === 1 ? map(current) : mapPath(current, path.slice(1), map);
    return updated === current ? value : replaceOwn(value, key, updated);
}
function replacePath(value, path, next) {
    return mapPath(value, path, () => next);
}
function replaceOwn(value, key, next) {
    const result = Object.create(Object.getPrototypeOf(value));
    for (const ownKey of Object.keys(value)) {
        Object.defineProperty(result, ownKey, {
            value: ownKey === key ? next : value[ownKey],
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
    if (!Object.hasOwn(value, key)) {
        Object.defineProperty(result, key, {
            value: next,
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
    return result;
}
function cloneRecord(value) {
    const result = Object.create(Object.getPrototypeOf(value));
    for (const key of Object.keys(value)) {
        setOwn(result, key, value[key]);
    }
    return result;
}
function setOwn(record, key, value) {
    Object.defineProperty(record, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
    });
}
function isDeepFrozen(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return true;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value);
    }
    if (typeof value !== 'object' || !Object.isFrozen(value)) {
        return false;
    }
    const cached = deepFrozenCache.get(value);
    if (cached !== undefined) {
        return cached;
    }
    deepFrozenCache.set(value, false);
    const frozen = isFrozenJsonContainer(value);
    deepFrozenCache.set(value, frozen);
    return frozen;
}
function isFrozenJsonContainer(value) {
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if ((array && prototype !== Array.prototype) ||
        (!array && prototype !== Object.prototype && prototype !== null)) {
        return false;
    }
    const keys = Reflect.ownKeys(value);
    const lengthDescriptor = array ? Object.getOwnPropertyDescriptor(value, 'length') : undefined;
    const arrayLength = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
    if (array && typeof arrayLength !== 'number') {
        return false;
    }
    for (const key of keys) {
        if (typeof key !== 'string' || !isFrozenJsonProperty(value, key, arrayLength)) {
            return false;
        }
    }
    return !array || keys.length === arrayLength + 1;
}
function isFrozenJsonProperty(value, key, arrayLength) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) {
        return false;
    }
    if (typeof arrayLength === 'number' && key === 'length') {
        return descriptor.value === arrayLength;
    }
    if (!descriptor.enumerable) {
        return false;
    }
    if (typeof arrayLength === 'number') {
        const index = Number(key);
        if (!Number.isSafeInteger(index) ||
            index < 0 ||
            String(index) !== key ||
            index >= arrayLength) {
            return false;
        }
    }
    return isDeepFrozen(descriptor.value);
}
function copyJson(value) {
    if (value === undefined)
        return undefined;
    return JSON.parse(JSON.stringify(value));
}
function freezeJson(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) {
            freezeJson(child);
        }
        Object.freeze(value);
    }
    return value;
}
