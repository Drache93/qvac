import { waitFor } from 'xstate';
import { RunLog } from '../../run-log/index.js';
import { copy } from '../../helpers/copy.js';
import { redactFailureTurns } from '../tool-turns.js';
import { didDrainTimeOut, raceDrain } from '../../helpers/drain.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { isRecord } from '../../guards.js';
import { createCompletionActors, createInvokeTracker } from './actors.js';
import { replayFinalRound, replaySuccessOutput } from './replay-output.js';
import { AbortedError, rehydrateError, tagError } from '../../helpers/engine-error.js';
import { turnText } from './turns.js';
import { CompletionMachine } from '../../machine/index.js';
function readRestoredSnapshot(value) {
    if (!isRecord(value) || Array.isArray(value))
        return undefined;
    const context = isRecord(value.context) && !Array.isArray(value.context) ? value.context : undefined;
    return { status: value.status, output: value.output, context };
}
function isActiveIdle(snapshot) {
    const value = snapshot.value;
    return isRecord(value) && value.active === 'idle';
}
function isPausedOrAwaitingRecovery(snapshot) {
    return snapshot.hasTag('paused');
}
function wasInActiveState(snapshot, name) {
    if (isRecord(snapshot.value) && snapshot.value.active === name) {
        return true;
    }
    const historyValue = Reflect.get(snapshot, 'historyValue');
    if (!isRecord(historyValue)) {
        return false;
    }
    return Object.values(historyValue).some((nodes) => Array.isArray(nodes) &&
        nodes.some((node) => isRecord(node) && node.id === `completion.active.${name}`));
}
function started({ runId, resume, parentRunId }) {
    if (resume) {
        return { type: 'run-resumed', runId };
    }
    return parentRunId ? { type: 'run-started', runId, parentRunId } : { type: 'run-started', runId };
}
export async function* runEngine(run, options = {}) {
    const { runId } = run;
    const journal = RunLog.openBoundary(options, runId);
    const core = journal.core;
    const release = RunLog.acquireRun(run.lockOwner ?? options.lockOwner ?? core, runId);
    try {
        if (!journal.restored) {
            await journal.restore();
        }
        else if (journal.knownLength !== core.length) {
            throw new Error(`Run ${runId} changed while opening`);
        }
        if (run.resume) {
            if (!journal.metadata) {
                throw new Error(`Run ${runId} does not exist`);
            }
            const requestMatches = run.request === undefined ||
                stableStringify(journal.metadata.request) === stableStringify(run.request);
            if (journal.metadata.runId !== runId ||
                (run.requestDigest !== undefined
                    ? journal.metadata.requestDigest !== run.requestDigest
                    : !requestMatches)) {
                throw new Error('Resume cannot replace the original model, conversation, or execution configuration');
            }
        }
        else {
            if (run.request === undefined) {
                throw new Error('A new run requires a request identity');
            }
            if (core.length) {
                throw new Error(`Run ${runId} already exists; use resume mode`);
            }
            if (run.recovery?.length) {
                throw new Error('Recovery resolutions require resume mode');
            }
            const metadata = {
                version: RunLog.VERSION,
                type: 'metadata',
                machine: CompletionMachine.VERSION,
                definition: CompletionMachine.definition(),
                xstate: RunLog.XSTATE_VERSION,
                runId,
                request: run.request,
                requestDigest: run.requestDigest,
                digestRunId: run.requestDigest ? runId : undefined,
                budget: run.budget,
                startedAt: run.now ? run.now() : undefined
            };
            await journal.append(metadata);
        }
        const restored = readRestoredSnapshot(journal.snapshot);
        if (restored && restored.context?.runId !== runId) {
            throw new Error('Run checkpoint identity does not match its metadata');
        }
        await journal.resolve(run.recovery ?? []);
        if (restored?.status === 'done') {
            yield started(run);
            const round = restored.context?.round;
            if (run.resume && typeof round === 'number') {
                yield { type: 'round-reset', runId, round, replacedTypes: ['content', 'thinking'] };
            }
            const output = restored.output;
            if (isRecord(output) && output.status === 'failure') {
                const failure = restored.context?.failure;
                const fallback = typeof output.error === 'string' ? output.error : 'Completion failed';
                throw rehydrateError(failure ? tagError(failure) : undefined, fallback);
            }
            yield* replaySuccessOutput({ runId, round, context: restored.context, output });
            return { status: 'replayed' };
        }
        yield started(run);
        const invokes = createInvokeTracker();
        const boot = RunLog.boundaryBoot(journal);
        const mailbox = createEventMailbox();
        const { ports, context } = await run.start({
            operations: createOperationPort(journal),
            invokes,
            boot
        });
        return yield* drive({
            journal,
            run,
            machine: CompletionMachine.create(context, ports.now).provide({
                actors: createCompletionActors({
                    ports,
                    journal,
                    invokes,
                    emitContent: (event) => mailbox.emit(event)
                })
            }),
            invokes,
            now: ports.now,
            durable: typeof options.onStep === 'function',
            onDetached: options.onDetached,
            mailbox
        });
    }
    finally {
        if (journal.detachedEffects) {
            journal.sealed = true;
        }
        release();
    }
}
async function* drive({ journal, run, machine, invokes, now, durable, onDetached, mailbox }) {
    const { runId, signal } = run;
    const pausedMs = run.resume && journal.snapshotSavedAt !== undefined
        ? Math.max(0, now() - journal.snapshotSavedAt)
        : 0;
    const { queue } = mailbox;
    let detached = false;
    const detach = () => {
        detached = true;
        if (!journal.detachedEffects) {
            journal.detachedEffects = invokes.waitForInvokes();
            onDetached?.(journal.detachedEffects, runId);
        }
    };
    let wake = () => { };
    let wakeVersion = 0;
    const notify = () => {
        wakeVersion++;
        wake();
    };
    mailbox.notify = notify;
    const { actor, persistence } = await RunLog.createPersistedActor(journal, machine, notify, now);
    actor.on('*', (event) => {
        queue.push(event);
        notify();
    });
    actor.subscribe({ next: notify, error: notify });
    const pause = () => {
        if (actor.getSnapshot().status === 'active') {
            actor.send({ type: 'PAUSE' });
        }
        notify();
    };
    signal?.addEventListener('abort', pause);
    let pumping = true;
    try {
        await persistence.checkpoint();
        const restored = actor.getSnapshot();
        actor.start();
        if (run.input) {
            pumpInput(run.input, (item) => {
                if (!pumping || actor.getSnapshot().status !== 'active') {
                    return pumping;
                }
                if ('reason' in item) {
                    queue.push({ type: 'input-rejected', runId, reason: item.reason });
                    notify();
                }
                else {
                    actor.send(inputMessage(item));
                }
                return pumping;
            }).catch(noop);
        }
        if (run.resume) {
            if (!actor.getSnapshot().hasTag('paused')) {
                pause();
            }
            const result = await drainResume({ actor, invokes, persistence, durable, detach });
            if (result) {
                return result;
            }
            yield* replayInterruptedGeneration(runId, restored);
            const uncertain = journal.uncertainWrite();
            if (uncertain) {
                actor.send({ type: 'RECOVERY_REQUIRED', operation: uncertain });
            }
            else if (!signal?.aborted) {
                actor.send({ type: 'RESUME', pausedMs });
            }
        }
        if (signal?.aborted) {
            pause();
        }
        else if (isActiveIdle(actor.getSnapshot())) {
            actor.send({ type: 'START' });
        }
        while (true) {
            if (journal.hasPendingFlush()) {
                await persistence.flush();
            }
            yield* drainQueue(queue);
            if (isActiveIdle(actor.getSnapshot()) && !signal?.aborted) {
                actor.send({ type: 'START' });
            }
            const snapshot = actor.getSnapshot();
            if (snapshot.status === 'error') {
                return { status: 'error', snapshot, error: snapshot.error };
            }
            if (snapshot.status === 'done') {
                break;
            }
            const isSettling = settling(snapshot);
            const settlingResult = isSettling
                ? await drainSettling({ actor, persistence, durable, detach })
                : undefined;
            if (settlingResult) {
                yield* drainQueue(queue);
                return settlingResult;
            }
            if (isSettling) {
                continue;
            }
            if (isPausedOrAwaitingRecovery(snapshot)) {
                return yield* finishPaused({
                    actor,
                    invokes,
                    persistence,
                    durable,
                    detach,
                    journal,
                    queue,
                    runId
                });
            }
            const observedWakeVersion = wakeVersion;
            if (queue.length) {
                continue;
            }
            await new Promise((resolve) => {
                wake = resolve;
                if (wakeVersion !== observedWakeVersion) {
                    resolve();
                }
            });
        }
        await persistence.flush();
        yield* drainQueue(queue);
        return { status: 'done', snapshot: actor.getSnapshot() };
    }
    finally {
        pumping = false;
        signal?.removeEventListener('abort', pause);
        try {
            if (actor.getSnapshot().status === 'active') {
                pause();
            }
            if (!detached && (await invokes.drainTimedOut())) {
                detach();
            }
            if (await shouldDetachWhileClosing({ detached, journal, actor })) {
                detach();
            }
            await persistence.checkpoint();
            await persistence.flush();
            run.settled?.(actor.getSnapshot());
        }
        finally {
            await persistence.dispose();
        }
    }
}
async function drainResume({ actor, invokes, persistence, durable, detach }) {
    if (await invokes.drainTimedOut()) {
        return interruptedResult({ actor, persistence, durable, detach });
    }
    if (!settling(actor.getSnapshot())) {
        return undefined;
    }
    const timedOut = didDrainTimeOut(await raceDrain(waitFor(actor, (state) => !settling(state))));
    return timedOut ? interruptedResult({ actor, persistence, durable, detach }) : undefined;
}
async function drainSettling(options) {
    const { actor, persistence, durable, detach } = options;
    const timedOut = didDrainTimeOut(await raceDrain(waitFor(actor, (state) => !settling(state))));
    return timedOut ? interruptedResult({ actor, persistence, durable, detach }) : undefined;
}
async function interruptedResult({ actor, persistence, durable, detach }) {
    detach();
    await persistence.flush();
    const snapshot = actor.getSnapshot();
    return durable
        ? { status: 'paused', snapshot }
        : { status: 'error', snapshot, error: tagError(new AbortedError()) };
}
async function detachIfDrained(invokes, detach) {
    if (await invokes.drainTimedOut()) {
        detach();
    }
}
function pendingRecovery(snapshot, journal) {
    const recovery = snapshot.context.recovery;
    return recovery && journal.getReceipt(recovery.id)?.status !== 'result' ? recovery : undefined;
}
async function* finishPaused({ actor, invokes, persistence, durable, detach, journal, queue, runId }) {
    await detachIfDrained(invokes, detach);
    await persistence.flush();
    const snapshot = actor.getSnapshot();
    const recovery = pendingRecovery(snapshot, journal);
    if (recovery) {
        const event = { type: 'recovery-required', runId, operation: copy(recovery) };
        yield event;
    }
    yield* drainQueue(queue);
    return durable
        ? { status: 'paused', snapshot }
        : { status: 'error', snapshot, error: tagError(new AbortedError()) };
}
async function shouldDetachWhileClosing({ detached, journal, actor }) {
    if (detached || journal.failure || !settling(actor.getSnapshot())) {
        return false;
    }
    return didDrainTimeOut(await raceDrain(waitFor(actor, (snapshot) => !settling(snapshot))));
}
function* replayInterruptedGeneration(runId, snapshot) {
    const { round, lastRound } = snapshot.context;
    const finishingRound = lastRound &&
        (wasInActiveState(snapshot, 'answering') ||
            wasInActiveState(snapshot, 'finishing') ||
            (wasInActiveState(snapshot, 'resolving') && !lastRound.toolCalls.length));
    const shouldReplay = wasInActiveState(snapshot, 'generating') ||
        wasInActiveState(snapshot, 'wrapping') ||
        finishingRound;
    if (!shouldReplay) {
        return;
    }
    yield { type: 'round-reset', runId, round };
    if (finishingRound && lastRound) {
        yield* replayFinalRound({ runId, round, last: lastRound, response: snapshot.context.response });
    }
}
async function pumpInput(input, deliver) {
    const iterator = input[Symbol.asyncIterator]();
    for (;;) {
        const next = await iterator.next();
        if (next.done || !deliver(next.value)) {
            return;
        }
    }
}
function inputMessage({ mode, id, text, notes }) {
    return notes === undefined
        ? { type: 'INPUT', mode, id, text }
        : {
            type: 'INPUT',
            mode,
            id,
            text,
            context: { notes },
            content: turnText(text, { notes })
        };
}
function noop() { }
function settling(snapshot) {
    const value = snapshot.value;
    return value === 'pausing';
}
function* drainQueue(queue) {
    while (queue.length) {
        const event = queue.shift();
        if (event) {
            yield event;
        }
    }
}
function createEventMailbox() {
    const mailbox = {
        queue: [],
        notify() { },
        emit(event) {
            mailbox.queue.push(event);
            mailbox.notify();
        }
    };
    return mailbox;
}
function createOperationPort(journal) {
    return Object.freeze({
        flush: () => journal.flush(),
        operation: operationPort(journal),
        getReceipt: (id) => journal.getReceipt(id),
        commitResultFacts: (id, facts) => journal.commitResultFacts(id, facts),
        uncertainWrite: () => journal.uncertainWrite(),
        settledCall: (receiptId) => journal.settledCall(receiptId),
        pendingArgumentsWereRedacted: (snapshot) => journal.pendingArgumentsWereRedacted(snapshot),
        recordRequest: (request, failures) => journal.recordRequest({
            ...request,
            params: {
                ...request.params,
                history: redactFailureTurns(request.params.history, failures, (value) => journal.redactValue(value))
            }
        })
    });
}
function operationPort(journal) {
    return journal.operation.bind(journal);
}
