import { isRecord } from './patch.js';
import { stableStringify } from '../helpers/stable-stringify.js';
import { foldMachineEventHistory, materializeSnapshotHistory, requestMessages, validateRequestHistory } from './history-codec.js';
export const RUN_LOG_PROTOCOL_VERSION = 1;
export const RUN_LOG_VERSION = 1;
const trustedBoots = new WeakSet();
const trustedJson = new WeakSet();
const redactedJson = new WeakSet();
export class InvalidEngineStep extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidEngineStep';
    }
}
function pendingCall(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        id: typeof value.id === 'string' ? value.id : undefined,
        name: typeof value.name === 'string' ? value.name : undefined,
        args: value.args,
        arguments: value.arguments
    };
}
function pendingContext(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const currentCall = pendingCall(value.currentCall);
    const toolQueue = Array.isArray(value.toolQueue)
        ? value.toolQueue.map(pendingCall).filter((call) => call !== undefined)
        : undefined;
    const lastRound = isRecord(value.lastRound) ? value.lastRound : undefined;
    const toolCalls = Array.isArray(lastRound?.toolCalls)
        ? lastRound.toolCalls.map(pendingCall).filter((call) => call !== undefined)
        : undefined;
    const pending = isRecord(value.pendingCall) ? value.pendingCall : undefined;
    const step = isRecord(value.prepareStep) ? value.prepareStep : undefined;
    return {
        runId: typeof value.runId === 'string' ? value.runId : undefined,
        round: typeof value.round === 'number' ? value.round : undefined,
        currentCall,
        pendingCall: pending ? { arguments: pending.arguments } : undefined,
        prepareStep: step
            ? {
                id: typeof step.id === 'string' ? step.id : undefined,
                tool: typeof step.tool === 'string' ? step.tool : undefined,
                args: isRecord(step.facts) ? step.args : undefined
            }
            : undefined,
        toolQueue,
        lastRound: toolCalls ? { toolCalls } : undefined
    };
}
function pendingSnapshot(value) {
    if (!isRecord(value)) {
        return {};
    }
    return {
        value: value.value,
        historyValue: value.historyValue,
        context: pendingContext(value.context)
    };
}
export function pendingToolArgs(snapshot, settled) {
    const { value, historyValue, context } = pendingSnapshot(snapshot);
    const isSettled = (id) => id !== undefined && settled?.(`${context?.runId}:round-${context?.round}:${id}:execute`);
    const isResolving = JSON.stringify(value ?? '').includes('resolving') ||
        (!JSON.stringify(value ?? '').includes('"active"') &&
            JSON.stringify(historyValue ?? '').includes('resolving'));
    return [
        ...(context?.prepareStep?.args !== undefined && !isSettled(context.prepareStep.id)
            ? [context.prepareStep.args]
            : []),
        ...(context?.currentCall && !isSettled(context.currentCall.id)
            ? [context.currentCall.args]
            : []),
        ...(context?.pendingCall ? [context.pendingCall.arguments] : []),
        ...(context?.toolQueue?.filter((call) => !isSettled(call.id)).map((call) => call.args) ?? []),
        ...(isResolving
            ? (context?.lastRound?.toolCalls
                ?.filter((call) => !isSettled(call.id))
                .map((call) => call.arguments) ?? [])
            : [])
    ].filter((args) => args !== undefined);
}
export function pendingCallNames(snapshot) {
    const { value, historyValue, context } = pendingSnapshot(snapshot);
    const isResolving = JSON.stringify(value ?? '').includes('resolving') ||
        (!JSON.stringify(value ?? '').includes('"active"') &&
            JSON.stringify(historyValue ?? '').includes('resolving'));
    const names = new Map();
    const put = (id, name) => {
        if (id === undefined || name === undefined)
            return;
        names.set(`${context?.runId}:round-${context?.round}:${id}:execute`, name);
    };
    if (context?.prepareStep?.args !== undefined) {
        put(context.prepareStep.id, context.prepareStep.tool);
    }
    put(context?.currentCall?.id, context?.currentCall?.name);
    for (const call of context?.toolQueue ?? []) {
        put(call.id, call.name);
    }
    if (isResolving) {
        for (const call of context?.lastRound?.toolCalls ?? []) {
            put(call.id, call.name);
        }
    }
    return names;
}
export function pendingCallArgs(snapshot, settled) {
    const { value, historyValue, context } = pendingSnapshot(snapshot);
    const isSettled = (receiptId) => settled?.(receiptId) === true;
    const isResolving = JSON.stringify(value ?? '').includes('resolving') ||
        (!JSON.stringify(value ?? '').includes('"active"') &&
            JSON.stringify(historyValue ?? '').includes('resolving'));
    const args = new Map();
    const put = (id, callArgs) => {
        if (id === undefined)
            return;
        const receiptId = `${context?.runId}:round-${context?.round}:${id}:execute`;
        if (!isSettled(receiptId)) {
            args.set(receiptId, callArgs);
        }
    };
    if (context?.prepareStep?.args !== undefined) {
        put(context.prepareStep.id, context.prepareStep.args);
    }
    if (context?.currentCall) {
        put(context.currentCall.id, context.currentCall.args);
    }
    for (const call of context?.toolQueue ?? []) {
        put(call.id, call.args);
    }
    if (isResolving) {
        for (const call of context?.lastRound?.toolCalls ?? []) {
            put(call.id, call.arguments);
        }
    }
    return args;
}
export function unsettledRedactedIds(redactedPendingIds, receipts) {
    const settledIds = new Set([...receipts].filter((receipt) => receipt.status === 'result').map((receipt) => receipt.id));
    return redactedPendingIds.filter((id) => !settledIds.has(id));
}
export function createEngineBoot() {
    return freezeBoot(emptyBoot());
}
export function prepareEngineBoot(value) {
    if (value === undefined) {
        return createEngineBoot();
    }
    if (trustedBoots.has(value)) {
        return value;
    }
    const captured = captureJson(value);
    validateBoot(captured);
    return freezeBoot(captured);
}
export function captureRunRecord(record) {
    const captured = captureJson(record);
    if (!isRunRecord(captured)) {
        throw new InvalidEngineStep('Malformed run record');
    }
    return captured;
}
export function brandCapturedRecord(value) {
    if (!value || typeof value !== 'object' || redactedJson.has(value)) {
        return value;
    }
    for (const key of Object.keys(value)) {
        brandCapturedRecord(Reflect.get(value, key));
    }
    Object.freeze(value);
    trustedJson.add(value);
    redactedJson.add(value);
    return value;
}
export function isCapturedJson(value) {
    return isRecord(value) && trustedJson.has(value);
}
export function createEngineStep(seq, expectedLength, records) {
    assertCounter(seq, 'step sequence');
    assertCounter(expectedLength, 'expected length');
    if (!Array.isArray(records) || records.length === 0) {
        throw new InvalidEngineStep('Engine step must contain at least one run record');
    }
    for (let index = 0; index < records.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
        if (!descriptor || !('value' in descriptor) || !trustedJson.has(descriptor.value)) {
            throw new InvalidEngineStep('Engine step records must be captured before use');
        }
    }
    const frozenRecords = Object.freeze(records.slice());
    trustedJson.add(frozenRecords);
    const step = Object.freeze({ seq, expectedLength, records: frozenRecords });
    trustedJson.add(step);
    return step;
}
export function captureEngineStep(step) {
    if (step && typeof step === 'object' && trustedJson.has(step))
        return step;
    if (!step || typeof step !== 'object') {
        throw new InvalidEngineStep('Engine step is required');
    }
    const seq = readDataProperty(step, 'seq');
    const expectedLength = readDataProperty(step, 'expectedLength');
    assertCounter(seq, 'step sequence');
    assertCounter(expectedLength, 'expected length');
    const recordsValue = readDataProperty(step, 'records');
    if (!Array.isArray(recordsValue)) {
        throw new InvalidEngineStep('Engine step records must be an array');
    }
    const records = [];
    for (let index = 0; index < recordsValue.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(recordsValue, String(index));
        if (!descriptor || !('value' in descriptor)) {
            throw new InvalidEngineStep('Engine step contains a missing or accessor record');
        }
        records.push(captureRunRecord(descriptor.value));
    }
    return createEngineStep(seq, expectedLength, records);
}
function emptyBoot() {
    return {
        protocolVersion: RUN_LOG_PROTOCOL_VERSION,
        length: 0,
        nextSeq: 0,
        machineVersion: null,
        xstateVersion: null,
        metadata: null,
        eventState: null,
        deltasSinceCheckpoint: 0,
        redactedPendingArgs: null,
        redactedPendingIds: [],
        unredactedLength: 0,
        restoredRedacted: false,
        forkBeforeWrite: [],
        receipts: [],
        intentArgs: []
    };
}
export function requestFromBoot(boot) {
    validateEngineBoot(boot);
    if (!boot.metadata) {
        throw new InvalidEngineStep('Run boot has no original request');
    }
    return copy(boot.metadata.request);
}
export function contextFromBoot(boot) {
    validateEngineBoot(boot);
    const snapshot = materializeSnapshotHistory(boot.snapshot, historyBase(boot));
    if (!isRecord(snapshot) || !isRecord(snapshot.context)) {
        return undefined;
    }
    return copy(snapshot.context);
}
export function buildEngineBoot(records, opts) {
    if (!Array.isArray(records)) {
        throw new InvalidEngineStep('Run records must be an array');
    }
    assertCounter(opts?.nextSeq, 'nextSeq');
    const boot = emptyBoot();
    for (const raw of records) {
        foldRecord(boot, raw);
    }
    boot.nextSeq = opts.nextSeq;
    validateBoot(boot);
    return freezeBoot(boot);
}
export function applyEngineStep(boot, step) {
    const capturedBoot = prepareEngineBoot(boot);
    const capturedStep = captureEngineStep(step);
    if (!capturedStep || typeof capturedStep !== 'object') {
        throw new InvalidEngineStep('Engine step is required');
    }
    assertCounter(capturedStep.seq, 'step sequence');
    assertCounter(capturedStep.expectedLength, 'expected length');
    if (capturedStep.seq !== capturedBoot.nextSeq) {
        throw new InvalidEngineStep(`Unexpected engine step sequence ${capturedStep.seq}; expected ${capturedBoot.nextSeq}`);
    }
    if (capturedStep.expectedLength !== capturedBoot.length) {
        throw new InvalidEngineStep(`Unexpected engine step length ${capturedStep.expectedLength}; expected ${capturedBoot.length}`);
    }
    if (!Array.isArray(capturedStep.records) || capturedStep.records.length === 0) {
        throw new InvalidEngineStep('Engine step must contain at least one run record');
    }
    if (!Number.isSafeInteger(capturedBoot.length + capturedStep.records.length)) {
        throw new InvalidEngineStep('Engine step exceeds the supported run length');
    }
    if (capturedBoot.nextSeq === Number.MAX_SAFE_INTEGER) {
        throw new InvalidEngineStep('Engine step sequence exceeds the supported range');
    }
    const next = cloneBoot(capturedBoot);
    for (const record of capturedStep.records) {
        foldRecord(next, record);
    }
    next.nextSeq++;
    validateBootEnvelope(next);
    return freezeBoot(next);
}
function validateBoot(boot) {
    if (!boot ||
        typeof boot !== 'object' ||
        !Object.hasOwn(boot, 'metadata') ||
        boot.protocolVersion !== RUN_LOG_PROTOCOL_VERSION) {
        throw new InvalidEngineStep('Unsupported engine boot protocol version');
    }
    for (const key of [
        'length',
        'nextSeq',
        'machineVersion',
        'xstateVersion',
        'deltasSinceCheckpoint',
        'redactedPendingArgs',
        'redactedPendingIds',
        'unredactedLength',
        'restoredRedacted',
        'forkBeforeWrite',
        'receipts',
        'intentArgs',
        'eventState'
    ]) {
        if (!Object.hasOwn(boot, key)) {
            throw new InvalidEngineStep(`Engine boot is missing ${key}`);
        }
    }
    assertCounter(boot.length, 'boot length');
    assertCounter(boot.nextSeq, 'boot nextSeq');
    assertCounter(boot.deltasSinceCheckpoint, 'delta count');
    assertCounter(boot.unredactedLength, 'unredacted length');
    if (!Array.isArray(boot.receipts) ||
        !Array.isArray(boot.intentArgs) ||
        !Array.isArray(boot.forkBeforeWrite) ||
        !Array.isArray(boot.redactedPendingIds) ||
        boot.redactedPendingIds.some((id) => typeof id !== 'string') ||
        boot.nextSeq > boot.length ||
        boot.unredactedLength > boot.length ||
        boot.deltasSinceCheckpoint > boot.length ||
        (boot.redactedPendingArgs !== null && typeof boot.redactedPendingArgs !== 'boolean') ||
        boot.restoredRedacted !== (boot.redactedPendingArgs === true)) {
        throw new InvalidEngineStep('Malformed engine boot maps');
    }
    if (boot.metadata === null) {
        if (boot.machineVersion !== null ||
            boot.xstateVersion !== null ||
            boot.length !== 0 ||
            boot.snapshot !== undefined ||
            boot.eventState !== null ||
            boot.snapshotSavedAt !== undefined ||
            boot.firstSavedAt !== undefined ||
            boot.deltasSinceCheckpoint !== 0 ||
            boot.unredactedLength !== 0 ||
            boot.redactedPendingArgs !== null ||
            boot.redactedPendingIds.length !== 0 ||
            boot.restoredRedacted ||
            boot.receipts.length !== 0 ||
            boot.intentArgs.length !== 0 ||
            boot.forkBeforeWrite.length !== 0) {
            throw new InvalidEngineStep('Engine boot metadata does not match its version fields');
        }
        return;
    }
    if (typeof boot.metadata !== 'object') {
        throw new InvalidEngineStep('Engine boot is missing trusted metadata');
    }
    if (boot.machineVersion !== boot.metadata.machine ||
        boot.xstateVersion !== (boot.metadata.xstate ?? null) ||
        boot.metadata.version !== RUN_LOG_VERSION ||
        typeof boot.metadata.runId !== 'string' ||
        boot.metadata.runId.length === 0 ||
        !Object.hasOwn(boot.metadata, 'request') ||
        !validBudget(boot.metadata.budget) ||
        boot.length < 1 ||
        boot.nextSeq < 1 ||
        (boot.metadata.requestDigest !== undefined &&
            (typeof boot.metadata.requestDigest !== 'string' ||
                typeof boot.metadata.digestRunId !== 'string' ||
                boot.metadata.digestRunId.length === 0)) ||
        (boot.metadata.startedAt !== undefined && !validTime(boot.metadata.startedAt)) ||
        (boot.metadata.xstate !== undefined && typeof boot.metadata.xstate !== 'string')) {
        throw new InvalidEngineStep('Engine boot metadata does not match its version fields');
    }
    if (boot.snapshot === undefined &&
        (boot.snapshotSavedAt !== undefined || boot.deltasSinceCheckpoint > 0)) {
        throw new InvalidEngineStep('Engine boot has checkpoint counters without a snapshot');
    }
    if (boot.firstSavedAt !== undefined && boot.snapshotSavedAt === undefined) {
        throw new InvalidEngineStep('Engine boot has a first checkpoint time without a snapshot');
    }
    if ((boot.snapshotSavedAt !== undefined && !validTime(boot.snapshotSavedAt)) ||
        (boot.firstSavedAt !== undefined && !validTime(boot.firstSavedAt))) {
        throw new InvalidEngineStep('Engine boot has invalid checkpoint timestamps');
    }
    if (boot.snapshot !== undefined && !isRecord(boot.snapshot)) {
        throw new InvalidEngineStep('Engine boot checkpoint is not a persisted snapshot');
    }
    if (boot.eventState !== null && !isRecord(boot.eventState)) {
        throw new InvalidEngineStep('Engine boot event-history projection is malformed');
    }
    if (new Set(boot.receipts.map((receipt) => receipt?.id)).size !== boot.receipts.length) {
        throw new InvalidEngineStep('Engine boot has duplicate operation receipts');
    }
    if ([...boot.intentArgs, ...boot.forkBeforeWrite].some((entry) => !Array.isArray(entry) || entry.length !== 2) ||
        new Set(boot.intentArgs.map(([id]) => id)).size !== boot.intentArgs.length ||
        new Set(boot.forkBeforeWrite.map(([id]) => id)).size !== boot.forkBeforeWrite.length) {
        throw new InvalidEngineStep('Engine boot has malformed operation maps');
    }
    const intentArgs = new Map();
    for (const [id, args] of boot.intentArgs) {
        if (typeof id !== 'string' || !id) {
            throw new InvalidEngineStep('Engine boot has invalid receipt args');
        }
        intentArgs.set(id, args);
    }
    const receiptIds = new Set();
    let abandonedCount = 0;
    for (const receipt of boot.receipts) {
        validateReceipt(receipt);
        const abandoned = receipt.status === 'result' && receipt.abandoned === true;
        if (receiptIds.has(receipt.id) ||
            (abandoned && intentArgs.has(receipt.id)) ||
            (!abandoned && !intentArgs.has(receipt.id))) {
            throw new InvalidEngineStep('Engine boot has inconsistent operation receipts');
        }
        receiptIds.add(receipt.id);
        if (abandoned) {
            abandonedCount++;
        }
        if (receipt.status !== 'result' &&
            stableStringify(receipt.args) !== stableStringify(intentArgs.get(receipt.id))) {
            throw new InvalidEngineStep('Engine boot operation arguments do not match their receipt');
        }
    }
    if (receiptIds.size - abandonedCount !== intentArgs.size) {
        throw new InvalidEngineStep('Engine boot has orphaned operation arguments');
    }
    for (const [id, length] of boot.forkBeforeWrite) {
        assertCounter(length, 'fork checkpoint length');
        if (length > boot.length) {
            throw new InvalidEngineStep('Engine boot fork point exceeds its length');
        }
        const receipt = boot.receipts.find((item) => item.id === id);
        if (!receipt || receipt.effect !== 'write' || receipt.name.startsWith('hook:')) {
            throw new InvalidEngineStep('Engine boot has an invalid write fork point');
        }
    }
}
function validateBootEnvelope(boot) {
    if (!boot ||
        typeof boot !== 'object' ||
        !Object.hasOwn(boot, 'metadata') ||
        !Object.hasOwn(boot, 'eventState') ||
        boot.protocolVersion !== RUN_LOG_PROTOCOL_VERSION) {
        throw new InvalidEngineStep('Unsupported engine boot protocol version');
    }
    assertCounter(boot.length, 'boot length');
    assertCounter(boot.nextSeq, 'boot nextSeq');
    assertCounter(boot.deltasSinceCheckpoint, 'delta count');
    assertCounter(boot.unredactedLength, 'unredacted length');
    if (!Array.isArray(boot.receipts) ||
        !Array.isArray(boot.intentArgs) ||
        !Array.isArray(boot.forkBeforeWrite) ||
        !Array.isArray(boot.redactedPendingIds) ||
        boot.nextSeq > boot.length ||
        boot.unredactedLength > boot.length ||
        boot.deltasSinceCheckpoint > boot.length ||
        (boot.redactedPendingArgs !== null && typeof boot.redactedPendingArgs !== 'boolean') ||
        boot.restoredRedacted !== (boot.redactedPendingArgs === true)) {
        throw new InvalidEngineStep('Malformed engine boot envelope');
    }
    if (boot.eventState !== null && !isRecord(boot.eventState)) {
        throw new InvalidEngineStep('Malformed engine boot event-history projection');
    }
    if (boot.metadata === null) {
        if (boot.length !== 0 || boot.nextSeq !== 0) {
            throw new InvalidEngineStep('Engine boot is missing trusted metadata');
        }
        return;
    }
    if (!isRecord(boot.metadata) ||
        boot.metadata.version !== RUN_LOG_VERSION ||
        boot.machineVersion !== boot.metadata.machine ||
        boot.xstateVersion !== (boot.metadata.xstate ?? null) ||
        typeof boot.metadata.runId !== 'string' ||
        boot.metadata.runId.length === 0 ||
        boot.length < 1 ||
        boot.nextSeq < 1) {
        throw new InvalidEngineStep('Engine boot metadata does not match its version fields');
    }
}
export function validateEngineBoot(boot) {
    if (trustedBoots.has(boot)) {
        return;
    }
    validateBoot(boot);
}
function assertCounter(value, label) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new InvalidEngineStep(`Invalid ${label}: expected a non-negative integer`);
    }
}
function validTime(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function validBudget(value) {
    return (isRecord(value) &&
        typeof value.deadlineMs === 'number' &&
        Number.isFinite(value.deadlineMs) &&
        typeof value.outputBytesUsed === 'number' &&
        Number.isSafeInteger(value.outputBytesUsed) &&
        value.outputBytesUsed >= 0);
}
function validateReceipt(receipt) {
    if (!isRecord(receipt) ||
        !['id', 'name', 'effect', 'status'].every((key) => Object.hasOwn(receipt, key)) ||
        typeof receipt.id !== 'string' ||
        receipt.id.length === 0 ||
        typeof receipt.name !== 'string' ||
        receipt.name.length === 0 ||
        (receipt.effect !== 'read' && receipt.effect !== 'write') ||
        (receipt.status !== 'intent' && receipt.status !== 'retry' && receipt.status !== 'result')) {
        throw new InvalidEngineStep('Malformed operation receipt');
    }
    if (receipt.status === 'result') {
        if (!Object.hasOwn(receipt, 'result') ||
            (receipt.resultUndefined !== undefined && receipt.resultUndefined !== true) ||
            (receipt.resultUndefined === true && receipt.result !== null) ||
            (receipt.abandoned !== undefined && receipt.abandoned !== true)) {
            throw new InvalidEngineStep('Malformed operation result receipt');
        }
    }
    else {
        if (!Object.hasOwn(receipt, 'args')) {
            throw new InvalidEngineStep('Operation intent is missing its arguments');
        }
        if (receipt.facts !== undefined) {
            throw new InvalidEngineStep('Unsettled operation receipt cannot carry result facts');
        }
    }
}
function isRunRecord(value) {
    if (!isRecord(value) || Array.isArray(value) || value.version !== RUN_LOG_VERSION) {
        return false;
    }
    return ['metadata', 'fork', 'checkpoint', 'delta', 'operation', 'request'].includes(String(value.type));
}
function resolveRedactedPendingIds(redactedPendingArgs, redactedPendingIds, snapshot) {
    if (redactedPendingIds === undefined) {
        return redactedPendingArgs === true ? [...pendingCallNames(snapshot).keys()] : [];
    }
    const pending = pendingCallNames(snapshot);
    for (const id of redactedPendingIds) {
        if (!pending.has(id)) {
            throw new InvalidEngineStep(`redactedPendingIds names a call that is not pending: ${id}`);
        }
    }
    return redactedPendingIds.slice();
}
function foldRecord(boot, input) {
    const record = captureRunRecord(input);
    if (!isRecord(record) ||
        !Object.hasOwn(record, 'version') ||
        !Object.hasOwn(record, 'type') ||
        record.version !== RUN_LOG_VERSION) {
        throw new InvalidEngineStep(`Unsupported run record version: ${record?.version ?? 'missing'}`);
    }
    const index = boot.length;
    if (record.type !== 'metadata' && boot.metadata === null) {
        throw new InvalidEngineStep('Run record appeared before trusted metadata');
    }
    switch (record.type) {
        case 'metadata':
            if (boot.metadata !== null || index !== 0) {
                throw new InvalidEngineStep('Duplicate or misplaced run metadata');
            }
            if (!Number.isSafeInteger(record.machine) || record.machine < 0) {
                throw new InvalidEngineStep('Run metadata has an invalid machine version');
            }
            if (typeof record.runId !== 'string' ||
                !Object.hasOwn(record, 'runId') ||
                record.runId.length === 0 ||
                !Object.hasOwn(record, 'request') ||
                !validBudget(record.budget) ||
                (record.startedAt !== undefined && !validTime(record.startedAt)) ||
                (record.requestDigest !== undefined &&
                    (typeof record.requestDigest !== 'string' ||
                        typeof record.digestRunId !== 'string' ||
                        record.digestRunId.length === 0))) {
                throw new InvalidEngineStep('Run metadata is missing required identity fields');
            }
            if (record.xstate !== undefined && typeof record.xstate !== 'string') {
                throw new InvalidEngineStep('Run metadata has an invalid XState version');
            }
            boot.metadata = record;
            boot.machineVersion = record.machine;
            boot.xstateVersion = record.xstate ?? null;
            boot.unredactedLength = index + 1;
            break;
        case 'checkpoint':
            if (!Object.hasOwn(record, 'snapshot') ||
                !Object.hasOwn(record, 'savedAt') ||
                !isRecord(record.snapshot) ||
                !validTime(record.savedAt)) {
                throw new InvalidEngineStep('Malformed run-log checkpoint');
            }
            validateCheckpointFields({
                redactedPendingArgs: record.redactedPendingArgs,
                redactedPendingIds: record.redactedPendingIds,
                events: record.events,
                trace: record.trace
            });
            if (record.reset !== undefined && record.reset !== true) {
                throw new InvalidEngineStep('Invalid checkpoint event reset marker');
            }
            boot.snapshot = captureJson(record.snapshot);
            foldEventRecords(boot, {
                events: record.events,
                reset: record.reset === true,
                resetAfter: true
            });
            boot.snapshotSavedAt = record.savedAt;
            boot.firstSavedAt ??= record.savedAt;
            boot.deltasSinceCheckpoint = 0;
            boot.redactedPendingArgs = record.redactedPendingArgs ?? null;
            boot.redactedPendingIds = resolveRedactedPendingIds(record.redactedPendingArgs, record.redactedPendingIds, boot.snapshot);
            if (boot.redactedPendingArgs === false) {
                boot.unredactedLength = index + 1;
            }
            break;
        case 'delta':
            if (boot.snapshot === undefined) {
                throw new InvalidEngineStep('Run-log delta without a checkpoint');
            }
            if (!validTime(record.savedAt)) {
                throw new InvalidEngineStep('Malformed run-log delta timestamp');
            }
            validateCheckpointFields({
                redactedPendingArgs: record.redactedPendingArgs,
                redactedPendingIds: record.redactedPendingIds,
                events: record.events,
                trace: record.trace
            });
            if (record.reset !== undefined && record.reset !== true) {
                throw new InvalidEngineStep('Invalid delta event reset marker');
            }
            if (record.patch !== undefined) {
                validatePatch(record.patch);
            }
            if (record.patch) {
                boot.snapshot = applyImmutable(boot.snapshot, record.patch);
            }
            foldEventRecords(boot, {
                events: record.events,
                reset: record.reset === true,
                resetAfter: false
            });
            boot.snapshotSavedAt = record.savedAt;
            boot.firstSavedAt ??= record.savedAt;
            boot.deltasSinceCheckpoint++;
            boot.redactedPendingArgs = record.redactedPendingArgs ?? null;
            boot.redactedPendingIds = resolveRedactedPendingIds(record.redactedPendingArgs, record.redactedPendingIds, boot.snapshot);
            if (boot.redactedPendingArgs === false) {
                boot.unredactedLength = index + 1;
            }
            break;
        case 'operation': {
            if (!Object.hasOwn(record, 'receipt')) {
                throw new InvalidEngineStep('Operation record is missing its receipt');
            }
            validateReceipt(record.receipt);
            validateReceiptTransition(boot, record.receipt);
            trackForkPoint(boot, record.receipt);
            setById(boot.receipts, record.receipt);
            if (record.receipt.status !== 'result') {
                setPair(boot.intentArgs, record.receipt.id, record.receipt.args);
            }
            break;
        }
        case 'fork': {
            if (!boot.metadata) {
                throw new InvalidEngineStep('Run-log fork without metadata');
            }
            if (typeof record.runId !== 'string' ||
                record.runId.length === 0 ||
                record.runId === boot.metadata.runId ||
                !isRecord(record.forkedFrom) ||
                record.forkedFrom.runId !== boot.metadata.runId ||
                !Number.isSafeInteger(record.forkedFrom.length) ||
                record.forkedFrom.length < 1 ||
                record.forkedFrom.length > index ||
                (record.forkedFrom.key !== undefined && typeof record.forkedFrom.key !== 'string') ||
                (record.segments !== undefined &&
                    (!Array.isArray(record.segments) ||
                        record.segments.some((segment) => !isRecord(segment) ||
                            typeof segment.key !== 'string' ||
                            !Number.isSafeInteger(segment.length) ||
                            segment.length < 0))) ||
                (record.request !== undefined && !isRecord(record.request))) {
                throw new InvalidEngineStep('Malformed run-log fork');
            }
            const from = boot.metadata.runId;
            const rename = (id) => id.startsWith(`${from}:`) ? record.runId + id.slice(from.length) : id;
            const request = Object.assign({}, isRecord(boot.metadata.request) ? boot.metadata.request : {}, record.request);
            if (stableStringify(request) !==
                stableStringify(isRecord(boot.metadata.request) ? boot.metadata.request : {})) {
                throw new InvalidEngineStep('A fork cannot change the recorded request identity');
            }
            const metadata = {
                ...boot.metadata,
                runId: record.runId,
                request: boot.metadata.request,
                forkedFrom: captureJson(record.forkedFrom)
            };
            boot.metadata = sealCapturedJson(metadata);
            boot.snapshot = isRecord(boot.snapshot)
                ? {
                    ...boot.snapshot,
                    context: isRecord(boot.snapshot.context)
                        ? { ...boot.snapshot.context, runId: record.runId }
                        : boot.snapshot.context
                }
                : boot.snapshot;
            const writes = boot.receipts.filter((receipt) => receipt.effect === 'write');
            const writeIds = new Set(writes.map((receipt) => receipt.id));
            boot.receipts = writes.map((receipt) => sealCapturedJson({ ...receipt, id: rename(receipt.id) }));
            boot.intentArgs = boot.intentArgs
                .filter(([id]) => writeIds.has(id))
                .map(([id, args]) => frozenPair(rename(id), captureJson(args)));
            boot.forkBeforeWrite = boot.forkBeforeWrite
                .filter(([id]) => writeIds.has(id))
                .map(([id, length]) => frozenPair(rename(id), length));
            boot.redactedPendingIds = [];
            break;
        }
        case 'request':
            validateRequestRecord(record, historyBase(boot));
            break;
        default:
            throw new InvalidEngineStep('Unknown run-log record type');
    }
    boot.length++;
    boot.restoredRedacted = boot.redactedPendingArgs === true;
}
function validateRequestRecord(record, base) {
    const counters = [record.round, record.attempt, record.droppedTurns, record.keep];
    const { tools, params } = record;
    if (!counters.every((value) => Number.isSafeInteger(value) && value >= 0) ||
        !isRecord(params) ||
        typeof params.modelId !== 'string' ||
        (params.generationParams !== undefined && !isRecord(params.generationParams)) ||
        (params.responseFormat !== undefined && !isRecord(params.responseFormat)) ||
        (params.toolDialect !== undefined && typeof params.toolDialect !== 'string') ||
        (params.kvCache !== undefined &&
            typeof params.kvCache !== 'string' &&
            typeof params.kvCache !== 'boolean') ||
        (tools !== undefined &&
            (!isRecord(tools) ||
                typeof tools.ref !== 'string' ||
                !/^[0-9a-f]{64}$/.test(tools.ref) ||
                (tools.block !== undefined && !Array.isArray(tools.block))))) {
        throw new InvalidEngineStep('Malformed run-log request');
    }
    try {
        validateRequestHistory(record.messages, base);
    }
    catch (error) {
        throw new InvalidEngineStep(`Malformed run-log request history: ${String(error)}`);
    }
}
function validateCheckpointFields(fields) {
    const { redactedPendingArgs, redactedPendingIds, events, trace } = fields;
    if (redactedPendingArgs !== undefined && typeof redactedPendingArgs !== 'boolean') {
        throw new InvalidEngineStep('Invalid pending-argument provenance flag');
    }
    if (redactedPendingIds !== undefined &&
        (!Array.isArray(redactedPendingIds) || redactedPendingIds.some((id) => typeof id !== 'string'))) {
        throw new InvalidEngineStep('Invalid pending-argument provenance ids');
    }
    if (events !== undefined) {
        if (!Array.isArray(events)) {
            throw new InvalidEngineStep('Invalid event patch list');
        }
        for (const event of events) {
            validatePatch(event);
        }
    }
    if (trace !== undefined) {
        if (!Array.isArray(trace)) {
            throw new InvalidEngineStep('Invalid machine trace');
        }
        for (const step of trace) {
            if (!isRecord(step) ||
                typeof step.eventType !== 'string' ||
                !Array.isArray(step.sourceIds) ||
                !Array.isArray(step.targetIds) ||
                !Array.isArray(step.guardNames) ||
                !Array.isArray(step.actionNames) ||
                [...step.sourceIds, ...step.targetIds, ...step.guardNames, ...step.actionNames].some((value) => typeof value !== 'string')) {
                throw new InvalidEngineStep('Malformed machine transition trace');
            }
        }
    }
}
function foldEventRecords(boot, { events, reset, resetAfter }) {
    let state = reset ? null : boot.eventState;
    try {
        for (const event of events ?? []) {
            state = foldMachineEventHistory(state, event, {
                base: undefined,
                validate: false
            });
        }
        boot.eventState = resetAfter ? null : state;
    }
    catch (error) {
        throw new InvalidEngineStep(`Malformed history reference in machine event: ${String(error)}`);
    }
}
function historyBase(boot) {
    return boot.metadata ? requestMessages(boot.metadata.request) : undefined;
}
function validatePatch(value) {
    if (!isRecord(value))
        throw new InvalidEngineStep('Malformed JSON patch');
    const variants = ['$', 't', 'o'].filter((key) => Object.hasOwn(value, key)).length;
    if (variants !== 1) {
        throw new InvalidEngineStep('Malformed JSON patch variant');
    }
    if (Object.hasOwn(value, '$')) {
        if (Object.keys(value).some((key) => key !== '$')) {
            throw new InvalidEngineStep('Malformed replacement patch');
        }
        return;
    }
    if (Object.hasOwn(value, 't')) {
        if (Object.keys(value).some((key) => key !== 't' && key !== 'a') ||
            typeof value.t !== 'number' ||
            !Number.isSafeInteger(value.t) ||
            value.t < 0 ||
            !Array.isArray(value.a)) {
            throw new InvalidEngineStep('Malformed array patch');
        }
        return;
    }
    const deletes = value.d;
    if (Object.keys(value).some((key) => key !== 'o' && key !== 'd') ||
        !isRecord(value.o) ||
        (deletes !== undefined &&
            (!Array.isArray(deletes) ||
                deletes.some((key) => typeof key !== 'string') ||
                new Set(deletes).size !== deletes.length))) {
        throw new InvalidEngineStep('Malformed object patch');
    }
    const objectPatch = value.o;
    for (const key of Object.keys(value.o)) {
        if (deletes?.includes(key)) {
            throw new InvalidEngineStep('Patch key is both deleted and updated');
        }
        validatePatch(objectPatch[key]);
    }
}
function validateReceiptTransition(boot, receipt) {
    const previous = boot.receipts.find((item) => item.id === receipt.id);
    if (!previous) {
        const abandoned = receipt.status === 'result' && receipt.abandoned === true;
        if (!abandoned) {
            if (receipt.status !== 'intent') {
                throw new InvalidEngineStep('Operation result or retry appeared without an intent');
            }
            return;
        }
        if (!pendingCallNames(boot.snapshot).has(receipt.id)) {
            throw new InvalidEngineStep('Abandoned receipt does not match a pending operation');
        }
        return;
    }
    if (previous.name !== receipt.name || previous.effect !== receipt.effect) {
        throw new InvalidEngineStep('Operation receipt identity changed');
    }
    if (receipt.status === 'result' && receipt.abandoned === true && previous.status !== 'result') {
        throw new InvalidEngineStep('A dispatched operation cannot be marked abandoned');
    }
    if (previous.status === 'result' && receipt.status !== 'result') {
        throw new InvalidEngineStep('A settled operation receipt cannot be downgraded');
    }
    if (receipt.status === 'result' && previous.status === 'retry') {
        throw new InvalidEngineStep('A retried operation must persist a new intent before its result');
    }
    if (receipt.status !== 'result') {
        const previousArgs = boot.intentArgs.find(([id]) => id === receipt.id)?.[1];
        if (stableStringify(previousArgs) !== stableStringify(receipt.args)) {
            throw new InvalidEngineStep('Operation arguments changed across attempts');
        }
    }
    if (receipt.status === 'retry' && previous.status !== 'intent') {
        throw new InvalidEngineStep('Only an unresolved operation can be marked for retry');
    }
    if (receipt.status === 'result' && previous.status === 'result') {
        const sameResult = previous.resultUndefined === receipt.resultUndefined &&
            stableStringify(previous.result) === stableStringify(receipt.result);
        const factsAdded = previous.facts === undefined && receipt.facts !== undefined;
        if (!sameResult ||
            (!factsAdded && stableStringify(previous.facts) !== stableStringify(receipt.facts))) {
            throw new InvalidEngineStep('Settled operation result changed');
        }
    }
}
function trackForkPoint(boot, receipt) {
    if (receipt.status === 'result' && receipt.abandoned === true)
        return;
    if (receipt.effect !== 'write' || receipt.name.startsWith('hook:'))
        return;
    const points = new Map(boot.forkBeforeWrite);
    if (receipt.status === 'intent') {
        setMap(points, receipt.id, boot.unredactedLength);
        boot.unredactedLength = 0;
        boot.forkBeforeWrite = [...points].map(([id, length]) => frozenPair(id, length));
        return;
    }
    boot.unredactedLength = points.get(receipt.id) ?? 0;
    boot.forkBeforeWrite = [...points].map(([id, length]) => frozenPair(id, length));
}
function setById(receipts, receipt) {
    const index = receipts.findIndex((item) => item.id === receipt.id);
    const saved = captureJson(receipt);
    if (index < 0) {
        receipts.push(saved);
    }
    else {
        receipts[index] = saved;
    }
}
function setPair(pairs, key, value) {
    const index = pairs.findIndex(([id]) => id === key);
    const saved = frozenPair(key, captureJson(value));
    if (index < 0) {
        pairs.push(saved);
    }
    else {
        pairs[index] = saved;
    }
}
function frozenPair(first, second) {
    const pair = [first, second];
    Object.freeze(pair);
    return pair;
}
function setMap(map, key, value) {
    map.set(key, value);
}
function defineOwn(record, key, value) {
    Object.defineProperty(record, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
    });
}
function cloneBoot(boot) {
    return {
        ...boot,
        forkBeforeWrite: boot.forkBeforeWrite.slice(),
        receipts: boot.receipts.slice(),
        intentArgs: boot.intentArgs.slice(),
        redactedPendingIds: boot.redactedPendingIds.slice()
    };
}
function applyImmutable(base, patch) {
    if ('$' in patch) {
        return captureJson(patch.$);
    }
    if ('t' in patch) {
        const array = Array.isArray(base) ? base.slice(0, Math.min(base.length, patch.t)) : [];
        return sealCapturedJson(array.concat(patch.a));
    }
    const objectPatch = patch;
    const record = isRecord(base) ? { ...base } : {};
    for (const key of (Object.hasOwn(objectPatch, 'd') ? objectPatch.d : undefined) ?? []) {
        if (Object.hasOwn(record, key)) {
            delete record[key];
        }
    }
    for (const key of Object.keys(objectPatch.o)) {
        const child = objectPatch.o[key];
        if (child === undefined) {
            throw new InvalidEngineStep('Malformed object patch');
        }
        const value = applyImmutable(Object.hasOwn(record, key) ? record[key] : undefined, child);
        defineOwn(record, key, value);
    }
    return sealCapturedJson(record);
}
function freezeBoot(boot) {
    Object.freeze(boot.forkBeforeWrite);
    Object.freeze(boot.receipts);
    Object.freeze(boot.intentArgs);
    Object.freeze(boot.redactedPendingIds);
    Object.freeze(boot);
    trustedBoots.add(boot);
    return boot;
}
function copy(value) {
    if (value === undefined) {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
}
function captureJson(value) {
    if (value && typeof value === 'object' && trustedJson.has(value))
        return value;
    return brandJson(copy(value));
}
function brandJson(value) {
    if (!value || typeof value !== 'object' || trustedJson.has(value)) {
        return value;
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            brandJson(value[index]);
        }
    }
    else {
        for (const key of Object.keys(value)) {
            brandJson(Reflect.get(value, key));
        }
    }
    Object.freeze(value);
    trustedJson.add(value);
    return value;
}
function sealCapturedJson(value) {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const child = value[index];
            if (child && typeof child === 'object' && !trustedJson.has(child)) {
                throw new InvalidEngineStep('Internal JSON subtree was not captured before reuse');
            }
        }
    }
    else {
        for (const key of Object.keys(value)) {
            const child = Reflect.get(value, key);
            if (child && typeof child === 'object' && !trustedJson.has(child)) {
                throw new InvalidEngineStep('Internal JSON subtree was not captured before reuse');
            }
        }
    }
    Object.freeze(value);
    trustedJson.add(value);
    return value;
}
function readDataProperty(record, key) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !('value' in descriptor)) {
        throw new InvalidEngineStep(`Engine step is missing its ${key} field`);
    }
    return descriptor.value;
}
