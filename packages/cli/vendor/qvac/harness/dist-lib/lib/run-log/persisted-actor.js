import { CompletionMachine } from '../machine/index.js';
import { createActor } from 'xstate';
import { EventCodec, RUN_LOG_VERSION, RunJournal } from './run-journal.js';
import { diff, isRecord } from './patch.js';
import { brandCapturedRecord, isCapturedJson } from './protocol.js';
const CHECKPOINT_EVERY = 64;
const ROOT_ACTOR_ID = 'qvac-completion-machine';
const UNRECORDED = new Set(['OUTPUT', 'xstate.stop']);
const noClock = () => 0;
export async function createPersistedActor(core, machine, onFailure, now = noClock) {
    const journal = core instanceof RunJournal ? core : new RunJournal(core);
    if (!journal.restored) {
        await journal.restore();
    }
    let observeChild;
    const codec = new EventCodec(journal.requestHistoryBase);
    const events = [];
    const trace = [];
    let fresh = true;
    const recordedBase = Object.create(machine);
    const recorded = Object.assign(recordedBase, {
        transition(...args) {
            if (!UNRECORDED.has(args[1].type)) {
                events.push(codec.encode(journal.redactValue(args[1])));
            }
            return machine.transition(...args);
        }
    });
    let rootActor;
    const isRootActor = (ref) => rootActor !== undefined && ref === rootActor;
    const actorRefId = (ref) => {
        if (typeof ref !== 'object' || ref === null || !('id' in ref)) {
            return undefined;
        }
        return typeof ref.id === 'string' ? ref.id : undefined;
    };
    const isInitialRootMicrostep = (event) => actorRefId(event.actorRef) === ROOT_ACTOR_ID &&
        event._transitions.some((transition) => transition.source.id === machine.id || transition.source.id.startsWith(`${machine.id}.`));
    const observeTrace = (event) => {
        for (const step of traceFromMicrostep(event)) {
            trace.push(step);
        }
    };
    const actor = createActor(recorded, {
        id: ROOT_ACTOR_ID,
        snapshot: journal.snapshot,
        inspect: (event) => {
            if (event.type === '@xstate.microstep' &&
                (isRootActor(event.actorRef) || isInitialRootMicrostep(event))) {
                observeTrace(event);
            }
            if (event.type === '@xstate.snapshot' &&
                !isRootActor(event.actorRef) &&
                event.snapshot.status === 'active') {
                observeChild?.();
            }
        }
    });
    rootActor = actor;
    let base = journal.exportSnapshot();
    let deltas = journal.deltasSinceCheckpoint;
    let seenContext;
    let seenStatus;
    let seenValue;
    let seenChildren;
    let seenChildCount = 0;
    let seenChildSnapshots = new WeakMap();
    let disposed = false;
    const previousOnFailure = journal.onFailure;
    const fail = (error) => {
        journal.failure ??= error;
        actor.stop();
        onFailure?.(error);
    };
    journal.onFailure = (error) => {
        previousOnFailure?.(error);
        fail(error);
    };
    const checkpoint = () => {
        if (disposed || journal.failure) {
            return journal.flush();
        }
        if (isDoneSnapshot(base)) {
            return journal.flush();
        }
        try {
            const live = actor.getSnapshot();
            const children = live.children;
            let childCount = 0;
            let childrenUnchanged = true;
            for (const id in children) {
                if (!Object.hasOwn(children, id))
                    continue;
                childCount++;
                const child = children[id];
                if (seenChildSnapshots.get(child) !== child.getSnapshot()) {
                    childrenUnchanged = false;
                }
            }
            if (live.context === seenContext &&
                live.status === seenStatus &&
                live.value === seenValue &&
                live.children === seenChildren &&
                childCount === seenChildCount &&
                childrenUnchanged &&
                events.length === 0 &&
                trace.length === 0) {
                return journal.flush();
            }
            seenContext = live.context;
            seenStatus = live.status;
            seenValue = live.value;
            seenChildren = live.children;
            seenChildCount = childCount;
            seenChildSnapshots = new WeakMap();
            for (const id in children) {
                if (!Object.hasOwn(children, id))
                    continue;
                const child = children[id];
                seenChildSnapshots.set(child, child.getSnapshot());
            }
            const snapshot = actor.getPersistedSnapshot();
            const recordedSnapshot = journal.compactSnapshot(journal.redactValue(snapshot));
            const savedAt = now();
            const redactedPendingArgs = journal.pendingArgumentsWereRedacted(snapshot);
            const redactedIds = journal.redactedPendingCallIds(snapshot);
            const reset = fresh ? true : undefined;
            if (base === undefined || deltas >= CHECKPOINT_EVERY) {
                base = recordedSnapshot;
                deltas = 0;
                fresh = false;
                const appended = journal.append({
                    version: RUN_LOG_VERSION,
                    type: 'checkpoint',
                    snapshot: recordedSnapshot,
                    savedAt,
                    redactedPendingArgs: redactedPendingArgs ?? undefined,
                    redactedPendingIds: redactedIds,
                    events: events.splice(0),
                    trace: trace.length ? trace.splice(0) : undefined,
                    reset
                });
                codec.reset();
                return appended;
            }
            const patch = diff(base, recordedSnapshot);
            if (!patch && events.length === 0 && trace.length === 0) {
                return journal.flush();
            }
            base = recordedSnapshot;
            deltas++;
            fresh = false;
            return journal.append({
                version: RUN_LOG_VERSION,
                type: 'delta',
                patch: patch && isCapturedJson(recordedSnapshot)
                    ? brandCapturedRecord(patch)
                    : (patch ?? undefined),
                savedAt,
                redactedPendingArgs: redactedPendingArgs ?? undefined,
                redactedPendingIds: redactedIds,
                events: events.splice(0),
                trace: trace.length ? trace.splice(0) : undefined,
                reset
            });
        }
        catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));
            fail(failure);
            return Promise.reject(failure);
        }
    };
    observeChild = () => {
        void checkpoint().catch(noop);
    };
    const subscription = actor.subscribe({
        next: () => {
            void checkpoint().catch(noop);
        },
        error: (error) => fail(error instanceof Error ? error : new Error(String(error)))
    });
    return {
        actor,
        persistence: {
            journal,
            checkpoint,
            flush: () => journal.flush(),
            async dispose() {
                if (!disposed) {
                    disposed = true;
                    subscription.unsubscribe();
                    actor.stop();
                }
                await journal.flush();
            }
        }
    };
}
function traceFromMicrostep(event) {
    if (UNRECORDED.has(event.event.type))
        return [];
    const trace = [];
    for (const transition of event._transitions) {
        if (UNRECORDED.has(transition.eventType))
            continue;
        trace.push({
            eventType: transition.eventType,
            sourceIds: [transition.source.id],
            targetIds: transition.target?.map((state) => state.id) ?? [],
            guardNames: transition.guard ? [CompletionMachine.transitionName(transition.guard)] : [],
            actionNames: transition.actions.map(CompletionMachine.transitionName)
        });
    }
    return trace;
}
function isDoneSnapshot(value) {
    return isRecord(value) && value.status === 'done';
}
function noop() { }
