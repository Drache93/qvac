import xstatePkg from 'xstate/package.json' with { type: 'json' };
import { RequestDecoder, RequestEncoder, requestRecord } from './request-codec.js';
import { CompletionMachine } from '../machine/index.js';
import { AbortedError, RecoveryRequired } from '../helpers/engine-error.js';
import { errorMessage, isRecord } from '../guards.js';
import { apply, diff } from './patch.js';
import { stableStringify } from '../helpers/stable-stringify.js';
import { copy } from '../helpers/copy.js';
import { compactMachineEvent, compactSnapshotHistory, materializeMachineEvent, materializeSnapshotHistory, snapshotFailureResultRefs, requestMessages, validateHistoryProjection, validateSnapshotHistory } from './history-codec.js';
import { RUN_LOG_VERSION, applyEngineStep, brandCapturedRecord, buildEngineBoot, createEngineBoot, prepareEngineBoot, captureRunRecord, InvalidEngineStep, isCapturedJson, validateEngineBoot, pendingCallNames, pendingCallArgs, pendingToolArgs, unsettledRedactedIds } from './protocol.js';
export { RUN_LOG_VERSION, RecoveryRequired, pendingCallNames, pendingToolArgs, unsettledRedactedIds };
export const XSTATE_VERSION = xstatePkg.version;
function compatibleXStateVersion(found) {
    if (found === null)
        return false;
    const saved = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(found);
    if (!saved) {
        return false;
    }
    const [major, minor, patch] = XSTATE_VERSION.split('.').map(Number);
    return Number(saved[1]) === major && Number(saved[2]) === minor && Number(saved[3]) <= patch;
}
export const ENGINE_BOUNDARY_BOOT = Symbol('engineBoundaryBoot');
export class RunIncompatible extends Error {
    runId;
    found;
    expected;
    kind;
    constructor(opts) {
        super(`Incompatible run log: ${opts.kind} version ${opts.found} (expected ${opts.expected})` +
            (opts.runId ? ` for run ${opts.runId}` : ''));
        this.name = 'RunIncompatible';
        this.runId = opts.runId;
        this.found = opts.found;
        this.expected = opts.expected;
        this.kind = opts.kind;
    }
}
function pendingWriteReceipts(receipts) {
    return [...receipts].filter((receipt) => receipt.effect === 'write' && receipt.status !== 'result' && !receipt.name.startsWith('hook:'));
}
export function unresolvedWriteIds(receipts) {
    return pendingWriteReceipts(receipts)
        .filter((receipt) => receipt.status === 'intent')
        .map((receipt) => receipt.id);
}
export function forkRepeatsSettledWrite(receipts, forkBeforeWrite, forkAt) {
    if (forkAt === null)
        return false;
    for (const receipt of receipts) {
        if (receipt.effect !== 'write' || receipt.name.startsWith('hook:'))
            continue;
        if (receipt.status === 'result' && receipt.abandoned === true)
            continue;
        if (receipt.status !== 'result' && receipt.status !== 'intent') {
            continue;
        }
        if (forkBeforeWrite.get(receipt.id) === forkAt) {
            return true;
        }
    }
    return false;
}
export function safeForkLength(receipts, forkBeforeWrite, unredactedLength) {
    const pendingWrites = pendingWriteReceipts(receipts);
    if (pendingWrites.length) {
        const lengths = [];
        for (const receipt of pendingWrites) {
            const length = forkBeforeWrite.get(receipt.id);
            if (typeof length !== 'number') {
                return null;
            }
            lengths.push(length);
        }
        const length = Math.min(...lengths);
        return length >= 1 ? length : null;
    }
    return unredactedLength >= 1 ? unredactedLength : null;
}
export function recoveryAdvice(ids, receipts, redactedPendingIds) {
    const byId = new Map();
    const redacted = new Set(redactedPendingIds);
    for (const receipt of receipts) {
        byId.set(receipt.id, receipt);
    }
    const dispatchedWrites = [];
    const others = [];
    for (const id of ids) {
        const receipt = byId.get(id);
        if (receipt?.status === 'intent' && receipt.effect === 'write' && !redacted.has(receipt.id)) {
            dispatchedWrites.push(id);
        }
        else {
            others.push(id);
        }
    }
    const clauses = [];
    if (dispatchedWrites.length > 0) {
        clauses.push(`resolve ${dispatchedWrites.join(', ')} with result or retry`);
    }
    if (others.length > 0) {
        clauses.push(`resolve ${others.join(', ')} with result or skip`);
    }
    return clauses.join('; ');
}
const RUN_RECORD_TYPES = new Set([
    'metadata',
    'checkpoint',
    'delta',
    'operation',
    'fork',
    'request'
]);
function readBoundaryBoot(core) {
    const candidate = Reflect.get(core, ENGINE_BOUNDARY_BOOT);
    if (typeof candidate !== 'function') {
        return undefined;
    }
    return () => candidate();
}
function eventRecord(value) {
    if (!isRecord(value) || Array.isArray(value)) {
        throw new Error('Run log event must be an object');
    }
    return value;
}
function inspectionRecord(value) {
    if (!isRecord(value)) {
        throw new InvalidEngineStep('Malformed run record');
    }
    if (typeof value.type !== 'string' || !RUN_RECORD_TYPES.has(value.type)) {
        throw new Error(`Unknown run-log record type: ${String(value.type)}`);
    }
    return captureRunRecord(value);
}
export class RunJournal {
    snapshotSavedAt;
    firstSavedAt;
    deltasSinceCheckpoint = 0;
    redactedPendingArgs = null;
    unredactedLength = 0;
    restoredRedacted = false;
    forkBeforeWrite = new Map();
    knownLength = 0;
    metadata;
    receipts = new Map();
    intentArgs = new Map();
    tail = Promise.resolve();
    requests = new RequestEncoder();
    settledTail = this.tail;
    uncertainWrite() {
        for (const receipt of this.receipts.values()) {
            if (receipt.effect === 'write' && receipt.status === 'intent') {
                return receipt;
            }
        }
        return undefined;
    }
    failure = null;
    detachedEffects = null;
    sealed = false;
    onFailure;
    core;
    restored = false;
    redact;
    redactShared;
    redactOperationResult;
    redactRecord;
    hasRedactionProvenance;
    initialBoot;
    engineBoot;
    compactedSnapshot;
    get snapshot() {
        return materializeSnapshotHistory(this.engineBoot.snapshot, requestMessages(this.engineBoot.metadata?.request));
    }
    get requestHistoryBase() {
        return requestMessages(this.engineBoot.metadata?.request);
    }
    compactSnapshot(snapshot) {
        const compacted = compactSnapshotHistory(snapshot, this.requestHistoryBase, this.compactedSnapshot);
        this.compactedSnapshot = snapshot;
        return isCapturedJson(snapshot) ? brandCapturedRecord(compacted) : compacted;
    }
    constructor(core, opts = {}) {
        this.core = core;
        const coreRedact = readCoreRedactor(core);
        this.redact = opts.redact ?? coreRedact ?? ((value) => value);
        this.redactShared = opts.redactShared ?? opts.redact ?? coreRedact ?? ((value) => value);
        this.redactOperationResult =
            opts.redactOperationResult ?? ((_operation, value) => this.redact(value));
        this.redactRecord = opts.redactRecord;
        this.hasRedactionProvenance =
            opts.redact !== undefined ||
                opts.redactShared !== undefined ||
                opts.redactRecord !== undefined ||
                coreRedact !== undefined;
        this.initialBoot = opts.boot ? prepareEngineBoot(opts.boot) : undefined;
        this.engineBoot = this.initialBoot ?? createEngineBoot();
    }
    redactValue(value) {
        return this.redactShared(value);
    }
    async restore() {
        await this.core.ready();
        if (this.initialBoot) {
            this.assertCompatibleBoot(this.initialBoot);
            this.restoreBoot(this.initialBoot);
            this.restored = true;
            this.knownLength = this.initialBoot.length;
            return;
        }
        const records = [];
        for (let i = 0; i < this.core.length; i++) {
            const raw = await this.core.get(i);
            const found = isRecord(raw) && typeof raw.version === 'number' ? raw.version : -1;
            if (found !== RUN_LOG_VERSION) {
                throw new RunIncompatible({
                    runId: this.metadata?.runId,
                    found,
                    expected: RUN_LOG_VERSION,
                    kind: 'log'
                });
            }
            const record = captureRunRecord(raw);
            records.push(record);
        }
        let boot;
        try {
            boot = buildEngineBoot(records, { nextSeq: records.length });
        }
        catch (error) {
            if (error instanceof InvalidEngineStep) {
                throw error;
            }
            throw new InvalidEngineStep(`Could not restore run boot: ${String(error)}`);
        }
        this.assertCompatibleBoot(boot);
        this.restoreBoot(boot);
        this.restored = true;
        this.knownLength = boot.length;
    }
    assertCompatibleBoot(boot) {
        validateEngineBoot(boot);
        if (this.core.length !== boot.length) {
            throw new Error('Run boot length does not match the opened store');
        }
        if (!boot.metadata) {
            return;
        }
        if (boot.machineVersion !== CompletionMachine.VERSION) {
            throw new RunIncompatible({
                runId: boot.metadata.runId,
                found: boot.machineVersion ?? -1,
                expected: CompletionMachine.VERSION,
                kind: 'machine'
            });
        }
        const base = requestMessages(boot.metadata.request);
        if (boot.snapshot !== undefined) {
            validateSnapshotHistory(boot.snapshot, base);
        }
        if (boot.eventState !== null) {
            validateHistoryProjection(boot.eventState, {
                base,
                failureRefs: boot.snapshot === undefined ? new Set() : snapshotFailureResultRefs(boot.snapshot)
            });
        }
        if (!compatibleXStateVersion(boot.xstateVersion)) {
            throw new RunIncompatible({
                runId: boot.metadata.runId,
                found: boot.xstateVersion ?? 'missing',
                expected: XSTATE_VERSION,
                kind: 'xstate'
            });
        }
    }
    restoreBoot(boot) {
        this.engineBoot = prepareEngineBoot(boot);
        this.metadata = boot.metadata ? copy(boot.metadata) : undefined;
        this.snapshotSavedAt = boot.snapshotSavedAt;
        this.firstSavedAt = boot.firstSavedAt;
        this.deltasSinceCheckpoint = boot.deltasSinceCheckpoint;
        this.redactedPendingArgs = boot.redactedPendingArgs;
        this.unredactedLength = boot.unredactedLength;
        this.restoredRedacted = boot.restoredRedacted;
        this.forkBeforeWrite.clear();
        for (const [id, length] of boot.forkBeforeWrite) {
            this.forkBeforeWrite.set(id, length);
        }
        this.receipts.clear();
        for (const receipt of boot.receipts) {
            this.receipts.set(receipt.id, copy(receipt));
        }
        this.intentArgs.clear();
        for (const [id, args] of boot.intentArgs) {
            this.intentArgs.set(id, copy(args));
        }
    }
    exportBoot() {
        return copy(this.engineBoot);
    }
    exportSnapshot() {
        return copy(this.engineBoot.snapshot);
    }
    trackForkPoint(receipt) {
        if (receipt.status === 'result' && receipt.abandoned === true)
            return;
        if (receipt.effect !== 'write' || receipt.name.startsWith('hook:'))
            return;
        if (receipt.status === 'intent') {
            this.forkBeforeWrite.set(receipt.id, this.unredactedLength);
            this.unredactedLength = 0;
            return;
        }
        this.unredactedLength = this.forkBeforeWrite.get(receipt.id) ?? 0;
    }
    settledCall(receiptId) {
        const receipt = this.receipts.get(receiptId);
        return receipt?.status === 'result';
    }
    unresolvedWriteIds() {
        const dispatched = unresolvedWriteIds(this.receipts.values());
        const queued = unsettledRedactedIds(this.engineBoot.redactedPendingIds, this.receipts.values()).filter((id) => !dispatched.includes(id));
        return [...dispatched, ...queued];
    }
    redactedPendingCallIds(snapshot) {
        if (!this.hasRedactionProvenance)
            return [];
        const isSettled = (receiptId) => this.settledCall(receiptId);
        const original = pendingCallArgs(snapshot, isSettled);
        const redacted = pendingCallArgs(this.redactShared(snapshot), isSettled);
        const ids = [];
        for (const [id, args] of original) {
            if (stableStringify(args) !== stableStringify(redacted.get(id))) {
                ids.push(id);
            }
        }
        return ids;
    }
    safeForkLength() {
        return safeForkLength(this.receipts.values(), this.forkBeforeWrite, this.unredactedLength);
    }
    getReceipt(receiptId) {
        const receipt = this.receipts.get(receiptId);
        return receipt === undefined ? undefined : copy(receipt);
    }
    async commitResultFacts(receiptId, facts) {
        await this.flush();
        if (this.sealed) {
            throw new AbortedError();
        }
        const receipt = this.receipts.get(receiptId);
        if (!receipt || receipt.status !== 'result') {
            throw new Error(`Cannot commit result facts without a settled receipt: ${receiptId}`);
        }
        const enriched = {
            id: receipt.id,
            name: receipt.name,
            effect: receipt.effect,
            status: 'result',
            result: copy(receipt.result),
            resultUndefined: receipt.resultUndefined,
            facts: this.redact(copy(facts)),
            abandoned: receipt.abandoned === true ? true : undefined
        };
        await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt: enriched });
        this.receipts.set(receiptId, copy(enriched));
    }
    retryLifecycleReceipts() {
        return [...this.receipts.values()]
            .filter((receipt) => receipt.status === 'retry' &&
            (receipt.name === 'hook:runPause' || receipt.name === 'hook:runResume'))
            .map(copy);
    }
    pendingArgumentsWereRedacted(snapshot) {
        if (!this.hasRedactionProvenance)
            return null;
        const isSettled = (receiptId) => this.settledCall(receiptId);
        const pending = pendingToolArgs(snapshot, isSettled);
        const redacted = pendingToolArgs(this.redactShared(snapshot), isSettled);
        if (pending.some((value, index) => stableStringify(value) !== stableStringify(redacted[index]))) {
            return true;
        }
        if (pending.length > 0 && this.restoredRedacted && this.snapshot !== undefined) {
            const saved = pendingToolArgs(this.snapshot, isSettled);
            return stableStringify(pending) === stableStringify(saved);
        }
        return false;
    }
    append(record) {
        let captured;
        try {
            captured = captureRunRecord(this.redactRecord ? this.redactRecord(record) : record);
        }
        catch (error) {
            this.fail(error);
            return Promise.reject(this.failure);
        }
        const next = this.tail.then(async () => {
            if (this.failure) {
                throw this.failure;
            }
            if (this.sealed)
                throw new AbortedError();
            const boundaryBoot = readBoundaryBoot(this.core);
            if (boundaryBoot) {
                const current = boundaryBoot();
                if (current.length !== this.engineBoot.length ||
                    current.nextSeq !== this.engineBoot.nextSeq) {
                    throw new Error('Internal engine boundary and run journal are out of sync');
                }
            }
            const step = {
                seq: this.engineBoot.nextSeq,
                expectedLength: this.engineBoot.length,
                records: [captured]
            };
            let candidate;
            if (!boundaryBoot) {
                candidate = applyEngineStep(this.engineBoot, step);
            }
            await this.core.append(captured);
            if (boundaryBoot) {
                const acknowledged = boundaryBoot();
                if (acknowledged.length !== this.engineBoot.length + 1 ||
                    acknowledged.nextSeq !== this.engineBoot.nextSeq + 1) {
                    throw new Error('Internal engine boundary did not acknowledge exactly one run record');
                }
                this.engineBoot = acknowledged;
            }
            else {
                if (!candidate) {
                    throw new Error('Run journal did not fold its acknowledged step');
                }
                this.engineBoot = candidate;
            }
            this.knownLength = this.engineBoot.length;
            this.metadata = this.engineBoot.metadata ?? undefined;
            this.snapshotSavedAt = this.engineBoot.snapshotSavedAt;
            this.firstSavedAt = this.engineBoot.firstSavedAt;
            this.deltasSinceCheckpoint = this.engineBoot.deltasSinceCheckpoint;
            this.redactedPendingArgs = this.engineBoot.redactedPendingArgs;
            this.unredactedLength = this.engineBoot.unredactedLength;
            this.restoredRedacted = this.engineBoot.restoredRedacted;
            this.forkBeforeWrite.clear();
            for (const [id, length] of this.engineBoot.forkBeforeWrite) {
                this.forkBeforeWrite.set(id, length);
            }
        });
        this.tail = next.catch((error) => {
            this.fail(error);
        });
        return next;
    }
    fail(error) {
        if (this.failure)
            return;
        this.failure = error instanceof Error ? error : new Error(String(error));
        this.onFailure?.(this.failure);
    }
    hasPendingFlush() {
        return this.failure !== null || this.tail !== this.settledTail;
    }
    async flush() {
        let pending;
        do {
            pending = this.tail;
            await pending;
        } while (pending !== this.tail);
        if (this.failure) {
            throw this.failure;
        }
        this.settledTail = pending;
    }
    async resolve(resolutions) {
        if (!Array.isArray(resolutions)) {
            throw new Error('Recovery resolutions must be an array');
        }
        const pendingNames = pendingCallNames(this.snapshot);
        const ids = new Set();
        const settledIds = new Set();
        for (const resolution of resolutions) {
            if (!resolution ||
                typeof resolution.operationId !== 'string' ||
                (resolution.decision !== 'retry' &&
                    resolution.decision !== 'result' &&
                    resolution.decision !== 'skip') ||
                (resolution.decision === 'result' && !('result' in resolution))) {
                throw new Error('Invalid recovery resolution');
            }
            if (ids.has(resolution.operationId)) {
                throw new Error(`Stale or mismatched recovery resolution: ${resolution.operationId}`);
            }
            const receipt = this.receipts.get(resolution.operationId);
            if (receipt) {
                const redactedWrite = receipt.effect === 'write' &&
                    receipt.status === 'intent' &&
                    this.engineBoot.redactedPendingIds.includes(receipt.id) &&
                    JSON.stringify(receipt.args).includes('[redacted]');
                if (receipt.status !== 'intent' ||
                    (resolution.decision === 'skip' && receipt.effect === 'write' && !redactedWrite)) {
                    throw new Error(`Stale or mismatched recovery resolution: ${resolution.operationId}`);
                }
            }
            else if (resolution.decision === 'retry' || !pendingNames.has(resolution.operationId)) {
                throw new Error(`Stale or mismatched recovery resolution: ${resolution.operationId}`);
            }
            ids.add(resolution.operationId);
            if (resolution.decision === 'result' || resolution.decision === 'skip') {
                settledIds.add(resolution.operationId);
            }
        }
        const stillUnsettled = unsettledRedactedIds(this.engineBoot.redactedPendingIds, this.receipts.values()).filter((id) => !settledIds.has(id));
        if (resolutions.some((resolution) => resolution.decision === 'retry') &&
            stillUnsettled.length > 0) {
            const forkAt = this.safeForkLength();
            const recoveryOperationIds = this.unresolvedWriteIds();
            const forkSafe = forkAt !== null &&
                !forkRepeatsSettledWrite(this.receipts.values(), this.forkBeforeWrite, forkAt);
            let message = 'This run cannot resume because pending tool arguments were redacted';
            if (forkSafe) {
                message += `; fork at ${forkAt} to continue without them`;
            }
            else if (recoveryOperationIds.length > 0) {
                message += `; ${recoveryAdvice(recoveryOperationIds, this.receipts.values(), this.engineBoot.redactedPendingIds)}`;
            }
            throw Object.assign(new Error(message), {
                code: 'PENDING_ARGS_REDACTED',
                forkAt,
                forkSafe,
                recoveryOperationIds
            });
        }
        for (const resolution of resolutions) {
            const previous = this.receipts.get(resolution.operationId);
            const providedResult = resolution.decision === 'result' ? resolution.result : undefined;
            if (previous) {
                if (previous.status === 'result') {
                    throw new Error(`Stale or mismatched recovery resolution: ${resolution.operationId}`);
                }
                const body = resolution.decision === 'skip'
                    ? { skipped: true, reason: 'not executed; arguments unavailable after resume' }
                    : (providedResult ?? null);
                const result = this.redactOperationResult(previous, copy(body));
                const receipt = resolution.decision === 'retry'
                    ? { ...previous, status: 'retry' }
                    : {
                        id: previous.id,
                        name: previous.name,
                        effect: previous.effect,
                        status: 'result',
                        result,
                        resultUndefined: resolution.decision === 'result' && providedResult === undefined
                            ? true
                            : undefined
                    };
                await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt });
                this.receipts.set(receipt.id, copy(receipt));
                this.trackForkPoint(receipt);
                continue;
            }
            const name = pendingNames.get(resolution.operationId);
            if (name === undefined) {
                throw new Error(`Stale or mismatched recovery resolution: ${resolution.operationId}`);
            }
            const body = resolution.decision === 'skip'
                ? { skipped: true, reason: 'not executed; arguments unavailable after resume' }
                : (providedResult ?? null);
            const result = this.redactOperationResult({ id: resolution.operationId, name, effect: 'write', args: undefined }, copy(body));
            const receipt = {
                id: resolution.operationId,
                name,
                effect: 'write',
                status: 'result',
                result,
                resultUndefined: undefined,
                abandoned: true
            };
            await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt });
            this.receipts.set(receipt.id, copy(receipt));
            this.trackForkPoint(receipt);
        }
    }
    async recordRequest(request) {
        if (this.sealed)
            throw new AbortedError();
        const whole = this.redactShared(requestRecord(request));
        const record = this.requests.encode(whole, this.requestHistoryBase);
        await this.append(isCapturedJson(whole) ? brandCapturedRecord(record) : record);
    }
    async operation(operation, execute, facts, signal) {
        if (this.sealed)
            throw new AbortedError();
        operation = this.redact(copy(operation));
        await this.flush();
        if (this.sealed) {
            throw new AbortedError();
        }
        const previous = this.receipts.get(operation.id);
        const previousArgs = this.intentArgs.get(operation.id);
        const abandoned = previous?.status === 'result' && previous.abandoned === true;
        if (previous &&
            !abandoned &&
            (previous.name !== operation.name ||
                stableStringify(previousArgs) !== stableStringify(operation.args) ||
                previous.effect !== operation.effect)) {
            throw new Error(`Operation identity mismatch: ${operation.id}`);
        }
        if (previous?.status === 'result') {
            if (previous.facts !== undefined) {
                facts?.restore(copy(previous.facts));
            }
            if (previous.resultUndefined) {
                return JSON.parse(JSON.stringify({ value: undefined })).value;
            }
            return JSON.parse(JSON.stringify(previous.result));
        }
        if (previous?.status === 'intent' && previous.effect === 'write') {
            throw new RecoveryRequired(previous);
        }
        const intent = { ...operation, status: 'intent' };
        await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt: intent });
        this.receipts.set(intent.id, copy(intent));
        this.intentArgs.set(intent.id, copy(intent.args));
        if (this.sealed) {
            throw new AbortedError();
        }
        if (signal?.aborted) {
            const retry = { ...operation, status: 'retry' };
            await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt: retry });
            this.receipts.set(retry.id, copy(retry));
            throw new AbortedError();
        }
        let result;
        try {
            result = await execute();
        }
        catch (error) {
            if (operation.effect === 'write') {
                throw error instanceof RecoveryRequired || error instanceof AbortedError
                    ? error
                    : new RecoveryRequired({
                        ...operation,
                        reason: this.redact(errorMessage(error))
                    });
            }
            throw error;
        }
        try {
            const resultValue = this.redactOperationResult(operation, copy(result === undefined ? null : result));
            const receipt = copy({
                id: operation.id,
                name: operation.name,
                effect: operation.effect,
                status: 'result',
                result: resultValue,
                resultUndefined: result === undefined ? true : undefined,
                facts: facts ? this.redact(copy(facts.capture())) : undefined
            });
            await this.append({ version: RUN_LOG_VERSION, type: 'operation', receipt });
            this.receipts.set(receipt.id, copy(receipt));
        }
        catch (error) {
            this.fail(error);
            throw error;
        }
        return result;
    }
}
function readCoreRedactor(core) {
    const candidate = Reflect.get(core, 'redactValue');
    if (typeof candidate !== 'function') {
        return undefined;
    }
    return (value) => candidate(value);
}
const owners = new WeakMap();
export function acquireRun(owner, runId) {
    const runs = owners.get(owner) ?? new Set();
    if (runs.has(runId)) {
        throw new Error(`Run ${runId} is already active`);
    }
    runs.add(runId);
    owners.set(owner, runs);
    return () => {
        runs.delete(runId);
    };
}
export class EventCodec {
    base = Object.create(null);
    historyBase;
    constructor(historyBase) {
        this.historyBase = historyBase;
    }
    reset() {
        this.base = Object.create(null);
    }
    encode(event) {
        const redacted = isCapturedJson(event);
        const compacted = compactMachineEvent(event, this.historyBase);
        const plain = eventRecord(redacted ? compacted : copy(compacted));
        const patch = diff(this.base, plain) ?? { o: {} };
        this.merge(plain);
        return redacted ? brandCapturedRecord(patch) : patch;
    }
    decode(patch) {
        const event = eventRecord(apply(copy(this.base), patch));
        this.merge(copy(event));
        return eventRecord(materializeMachineEvent(event, this.historyBase));
    }
    merge(event) {
        for (const [key, value] of Object.entries(defined(event))) {
            const previous = Object.hasOwn(this.base, key) ? this.base[key] : undefined;
            Object.defineProperty(this.base, key, {
                value: isObject(value) && isObject(previous) ? { ...previous, ...defined(value) } : value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    }
}
function defined(record) {
    return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}
function isObject(value) {
    return isRecord(value) && !Array.isArray(value);
}
export class RunLogFold {
    boot = createEngineBoot();
    codec = new EventCodec();
    anyMachine;
    constructor(opts = {}) {
        this.anyMachine = opts.anyMachine === true;
    }
    add(raw) {
        const index = this.boot.length;
        const found = isRecord(raw) && typeof raw.version === 'number' ? raw.version : -1;
        if (found !== RUN_LOG_VERSION) {
            throw new RunIncompatible({
                runId: this.boot.metadata?.runId,
                found,
                expected: RUN_LOG_VERSION,
                kind: 'log'
            });
        }
        const record = inspectionRecord(raw);
        const next = applyEngineStep(this.boot, {
            seq: this.boot.nextSeq,
            expectedLength: this.boot.length,
            records: [record]
        });
        if (record.type === 'metadata') {
            this.codec = new EventCodec(requestMessages(record.request));
            if (record.machine !== CompletionMachine.VERSION && !this.anyMachine) {
                throw new RunIncompatible({
                    runId: record.runId,
                    found: record.machine,
                    expected: CompletionMachine.VERSION,
                    kind: 'machine'
                });
            }
        }
        let events = [];
        if (record.type === 'checkpoint' || record.type === 'delta') {
            if (record.reset) {
                this.codec.reset();
            }
            events = (record.events ?? []).map((patch) => this.codec.decode(patch));
            if (record.type === 'checkpoint') {
                this.codec.reset();
            }
        }
        this.boot = next;
        return {
            index,
            record,
            snapshot: materializeSnapshotHistory(this.boot.snapshot, requestMessages(this.boot.metadata?.request)),
            events
        };
    }
}
export async function* readRunLog(core, opts = {}) {
    await core.ready();
    const fold = new RunLogFold(opts);
    for (let index = 0; index < core.length; index++) {
        yield fold.add(await core.get(index));
    }
}
export async function* readRequests(core) {
    await core.ready();
    let boot = createEngineBoot();
    const decoder = new RequestDecoder();
    for (let index = 0; index < core.length; index++) {
        const record = captureRunRecord(await core.get(index));
        boot = applyEngineStep(boot, {
            seq: boot.nextSeq,
            expectedLength: boot.length,
            records: [record]
        });
        if (record.type !== 'request') {
            continue;
        }
        const { round, attempt, droppedTurns } = record;
        const params = decoder.decode(record, requestMessages(boot.metadata?.request));
        yield { index, round, attempt, droppedTurns, params };
    }
}
