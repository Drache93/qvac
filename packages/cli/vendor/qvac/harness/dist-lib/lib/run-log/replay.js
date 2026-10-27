import { CompletionMachine } from '../machine/index.js';
import { createActor, transition } from 'xstate';
import { diff } from './patch.js';
import { isRecord } from '../guards.js';
import { readRunLog } from './run-journal.js';
import { copy } from '../helpers/copy.js';
import { stableStringify } from '../helpers/stable-stringify.js';
export class ReplayDivergence extends Error {
    index;
    drift;
    constructor(index, drift) {
        super(`Replay diverges from the run log at record ${index}: ${JSON.stringify(drift)}`);
        this.name = 'ReplayDivergence';
        this.index = index;
        this.drift = drift;
    }
}
export class ReplayTraceDivergence extends Error {
    index;
    expected;
    actual;
    constructor(index, expected, actual) {
        super(`Transition trace replay diverges from the run log at record ${index}`);
        this.name = 'ReplayTraceDivergence';
        this.index = index;
        this.expected = expected;
        this.actual = actual;
    }
}
export async function* replayRun(machine, core) {
    let current;
    for await (const { index, record, snapshot, events } of readRunLog(core)) {
        if (record.type === 'fork' && current) {
            current = createActor(machine, { snapshot: parsePersistedSnapshot(snapshot) }).getSnapshot();
            continue;
        }
        if (record.type !== 'checkpoint' && record.type !== 'delta') {
            continue;
        }
        if (!current) {
            if (record.type !== 'checkpoint') {
                throw new Error('Run log has a delta before any checkpoint');
            }
            current = createActor(machine, { snapshot: parsePersistedSnapshot(snapshot) }).getSnapshot();
            continue;
        }
        const parsedEvents = events.map(parseReplayEvent);
        verifyRecordTrace(machine, {
            start: current,
            events: parsedEvents,
            expected: record.trace ?? [],
            index
        });
        for (const event of parsedEvents) {
            current = transition(machine, current, event)[0];
            yield { index, event, snapshot: current };
        }
        const drift = diff(view(snapshot), view(machine.getPersistedSnapshot(current)));
        if (drift) {
            throw new ReplayDivergence(index, drift);
        }
    }
}
function verifyRecordTrace(machine, input) {
    let current = input.start;
    const actual = [];
    for (const event of input.events) {
        actual.push(...transitionTrace(machine, current, event));
        current = transition(machine, current, event)[0];
    }
    assertTrace(input.index, input.expected, actual);
}
function transitionTrace(machine, snapshot, event) {
    return machine.getTransitionData(snapshot, event).map((item) => ({
        eventType: item.eventType ?? '',
        sourceIds: [item.source.id],
        targetIds: item.target?.map((state) => state.id) ?? [],
        guardNames: item.guard ? [CompletionMachine.transitionName(item.guard)] : [],
        actionNames: item.actions.map(CompletionMachine.transitionName)
    }));
}
function assertTrace(index, expected, actual) {
    const triggeredExpected = expected.filter((item) => item.eventType !== '');
    const triggeredActual = actual.filter((item) => item.eventType !== '');
    if (stableStringify(triggeredExpected) !== stableStringify(triggeredActual)) {
        throw new ReplayTraceDivergence(index, triggeredExpected, triggeredActual);
    }
}
function view(snapshot) {
    const detached = copy(snapshot);
    if (!isRecord(detached)) {
        throw new Error('Machine replay snapshot is malformed');
    }
    const children = detached.children;
    return {
        value: detached.value,
        status: detached.status,
        context: detached.context,
        historyValue: detached.historyValue,
        children: isRecord(children) ? Object.keys(children).sort() : [],
        output: detached.output,
        error: detached.error
    };
}
export function parsePersistedSnapshot(value) {
    const snapshot = copy(value);
    if (!isRecord(snapshot) || !isSnapshotStatus(snapshot.status)) {
        throw new Error('Machine replay snapshot is malformed');
    }
    if ((snapshot.status === 'active' || snapshot.status === 'stopped') &&
        (snapshot.output !== undefined || snapshot.error !== undefined)) {
        throw new Error('Machine replay snapshot has output or error for a nonterminal state');
    }
    if (snapshot.status === 'done' && snapshot.error !== undefined) {
        throw new Error('Machine replay snapshot has an error for a done state');
    }
    if (snapshot.status === 'error' && snapshot.output !== undefined) {
        throw new Error('Machine replay snapshot has output for an error state');
    }
    return snapshot;
}
function parseReplayEvent(value) {
    if (!isRecord(value) || typeof value.type !== 'string') {
        throw new Error('Machine replay event is malformed');
    }
    return { ...value, type: value.type };
}
function isSnapshotStatus(value) {
    return value === 'active' || value === 'done' || value === 'error' || value === 'stopped';
}
