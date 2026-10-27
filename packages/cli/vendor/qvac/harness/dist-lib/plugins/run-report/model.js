import { createActor } from 'xstate';
import { CompletionMachine } from '../../lib/machine/index.js';
import { errorMessage, isRecord } from '../../lib/guards.js';
import { RunLog } from '../../lib/run-log/index.js';
import { story } from './story.js';
import { decide } from './why.js';
export async function reportModel(core, live = false) {
    const requests = new Map();
    for await (const request of RunLog.requests(core)) {
        requests.set(request.index, request.params);
    }
    const fold = new Fold(requests, live);
    for await (const entry of RunLog.read(core, { anyMachine: true })) {
        fold.add(entry);
    }
    return fold.finish();
}
class Fold {
    model = {
        run: emptySummary(),
        definition: null,
        steps: [],
        visits: {},
        edges: {},
        story: { prompt: '', rounds: [], tools: [] },
        hops: [],
        running: false
    };
    calls = new Map();
    approvals = new Map();
    rounds = new Map();
    receipts = new Map();
    machine = null;
    current = null;
    previous;
    started = false;
    lastSaved = 0;
    round = 0;
    requests;
    live;
    constructor(requests, live) {
        this.requests = requests;
        this.live = live;
    }
    add(entry) {
        const { index, record } = entry;
        if (record.type === 'metadata') {
            this.metadata(record);
        }
        else if (record.type === 'operation') {
            this.receipt(index, record.receipt);
        }
        else if (record.type === 'request') {
            this.request(index, record);
        }
        else if (record.type === 'checkpoint' || record.type === 'delta') {
            this.transition(entry, record);
        }
    }
    finish() {
        const snapshot = Object(this.previous);
        const context = Object(snapshot.context);
        const output = Object(snapshot.output);
        const metrics = Object(output.metrics ?? context.metrics);
        Object.assign(this.model.run, {
            endedAt: this.lastSaved || null,
            status: String(snapshot.status ?? 'unknown'),
            outcome: String(output.status ?? context.outcome ?? snapshot.status ?? 'unknown'),
            response: String(output.response ?? context.response ?? ''),
            failure: failureOf(context, output),
            rounds: Array.isArray(metrics.rounds)
                ? metrics.rounds.length
                : Number(context.round ?? 0) + 1,
            tokens: typeof metrics.tokens === 'number' ? metrics.tokens : null
        });
        this.model.story = story({
            context,
            calls: this.calls,
            approvals: this.approvals,
            requests: this.rounds,
            running: this.live && this.model.run.status === 'active'
        });
        this.model.running = this.live && this.model.run.status === 'active';
        return this.model;
    }
    metadata(record) {
        const request = Object(record.request);
        const budget = Object(record.budget);
        this.model.definition = isDefinition(record.definition) ? record.definition : null;
        Object.assign(this.model.run, {
            runId: record.runId,
            model: String(Object(request.agent).model ?? request.model ?? '?'),
            agent: String(Object(request.agent).id ?? request.agentId ?? 'default'),
            startedAt: record.startedAt ?? null,
            deadline: typeof budget.deadlineMs === 'number' ? budget.deadlineMs : null,
            machine: record.machine
        });
        if (record.machine !== CompletionMachine.VERSION || record.xstate !== RunLog.XSTATE_VERSION) {
            this.model.run.replay = `Recorded on machine v${record.machine} and xstate ${record.xstate ?? '?'}; this report runs v${CompletionMachine.VERSION} and ${RunLog.XSTATE_VERSION}, so routes are not re-weighed.`;
            return;
        }
        this.machine = CompletionMachine.create();
    }
    receipt(index, receipt) {
        const known = this.receipts.get(receipt.id);
        if (receipt.status === 'result' && known) {
            Object.assign(known, { result: receipt.result, settled: true });
            this.approval(receipt);
            return;
        }
        const step = {
            kind: 'receipt',
            index,
            round: Number(/:round-(\d+):/.exec(receipt.id)?.[1] ?? this.round),
            id: receipt.id,
            name: receipt.name,
            effect: receipt.effect,
            args: receipt.status === 'result' ? undefined : receipt.args,
            result: receipt.status === 'result' ? receipt.result : undefined,
            settled: receipt.status === 'result'
        };
        this.receipts.set(receipt.id, step);
        this.model.steps.push(step);
    }
    approval(receipt) {
        const named = /:round-(\d+):(.+):approve$/.exec(receipt.id);
        if (receipt.name === 'human:approve' && named && receipt.status === 'result') {
            this.approvals.set(`${named[1]}:${named[2]}`, receipt.result === true);
        }
    }
    request(index, record) {
        if (!this.rounds.has(record.round)) {
            this.rounds.set(record.round, index);
        }
        const params = Object(this.requests.get(index));
        const history = Array.isArray(params.history) ? params.history : [];
        const tools = Array.isArray(params.tools) ? params.tools : [];
        this.model.steps.push({
            kind: 'request',
            index,
            round: record.round,
            attempt: record.attempt,
            droppedTurns: record.droppedTurns,
            appended: history.slice(record.keep),
            tools: tools.map((tool) => String(Object(Object(tool).function ?? tool).name ?? '?'))
        });
    }
    transition({ index, snapshot, events }, record) {
        const previous = this.previous;
        this.saw(snapshot, record.savedAt, events);
        if (!this.started) {
            this.begin(snapshot);
            return;
        }
        this.inspected(index, snapshot, events);
        const micro = events.flatMap((event) => this.replay(event));
        const recorded = record.trace ?? [];
        this.restore(snapshot);
        const from = Object(previous).value;
        const to = Object(snapshot).value;
        const drift = this.machine !== null && routes(micro) !== routesOf(recorded);
        const walked = drift ? [] : micro;
        const step = {
            kind: 'transition',
            index,
            round: this.round,
            at: record.savedAt,
            from,
            to,
            events,
            micro,
            recorded,
            changes: record.type === 'delta' ? changes(record.patch, { before: previous, after: snapshot }) : [],
            entered: entered(walked, from, to),
            taken: this.taken(walked, recorded),
            facts: events.length > 0 && events.every((event) => event.type === 'FACTS'),
            drift
        };
        this.count(step);
    }
    saw(snapshot, savedAt, events) {
        this.previous = snapshot;
        this.round = Number(Object(Object(snapshot).context).round ?? this.round);
        this.lastSaved = savedAt;
        this.learn(snapshot, events);
    }
    inspected(index, snapshot, events) {
        const round = Object(Object(snapshot).context).round;
        for (const event of events) {
            const call = Object(Object(event.output).call);
            if (String(event.type).endsWith('.tools.inspecting') && typeof call.id === 'string') {
                this.calls.set(`${round}:${call.id}`, {
                    name: String(call.name),
                    args: call.args,
                    step: index
                });
            }
        }
    }
    begin(snapshot) {
        this.started = true;
        this.restore(snapshot);
        for (const id of activeIds(Object(snapshot).value, 'completion')) {
            this.model.visits[id] = [];
        }
    }
    taken(micro, recorded) {
        const keys = micro.length > 0
            ? micro.flatMap((each) => each.candidates.filter((c) => c.verdict === 'taken').map((c) => c.key))
            : recorded.flatMap((item) => routeKeys(this.model.definition, item));
        return [...new Set(keys)];
    }
    count(step) {
        const { index, entered, taken } = step;
        this.model.steps.push(step);
        for (const id of entered) {
            ;
            (this.model.visits[id] ??= []).push(index);
        }
        for (const key of taken) {
            ;
            (this.model.edges[key] ??= []).push(index);
        }
    }
    learn(snapshot, events) {
        const run = this.model.run;
        const policy = Object(Object(Object(snapshot).context).policy);
        run.maxToolRounds ??= typeof policy.maxToolRounds === 'number' ? policy.maxToolRounds : null;
        const facts = Object(events.find((event) => event.type === 'FACTS')?.value);
        const tools = Array.isArray(facts.tools) ? facts.tools : [];
        if (run.tools.length === 0 && tools.length > 0) {
            run.tools = tools.map((tool) => String(Object(tool).name ?? '?'));
        }
    }
    replay(event) {
        if (!this.machine || !this.current || typeof event.type !== 'string') {
            return [];
        }
        try {
            const decided = decide(this.machine, this.current, { ...event, type: event.type });
            this.current = decided.at(-1)?.after ?? this.current;
            return decided.map(({ eventType, before, after, candidates }) => ({
                eventType,
                from: before.value,
                to: after.value,
                candidates
            }));
        }
        catch (error) {
            this.model.run.replay ||= `Routes could not be re-weighed: ${errorMessage(error)}`;
            return [];
        }
    }
    restore(snapshot) {
        if (!this.machine || !isRecord(snapshot)) {
            return;
        }
        try {
            const persisted = RunLog.parseSnapshot(snapshot);
            this.current = createActor(this.machine, { snapshot: persisted }).getSnapshot();
        }
        catch (error) {
            this.model.run.replay ||= `A recorded snapshot did not restore: ${errorMessage(error)}`;
            this.current = null;
        }
    }
}
function failureOf(context, output) {
    const reason = [
        context.failMessage,
        Object(context.failure).message,
        Object(output.error).message,
        output.error
    ];
    const found = reason.find((value) => typeof value === 'string' && value.length > 0);
    return typeof found === 'string' ? found : '';
}
function entered(micro, from, to) {
    const walks = micro.length > 0 ? micro : [{ from, to }];
    const out = new Set();
    for (const walk of walks) {
        const was = new Set(activeIds(walk.from, 'completion'));
        for (const id of activeIds(walk.to, 'completion')) {
            if (!was.has(id)) {
                out.add(id);
            }
        }
    }
    return [...out];
}
function routeKeys(definition, item) {
    return item.sourceIds.flatMap((source) => {
        const state = find(definition, source);
        const event = item.eventType || 'always';
        const list = (item.eventType ? state?.on?.[item.eventType] : state?.always) ?? [];
        const index = list.findIndex((route) => item.targetIds.every((target) => route.target?.includes(target)));
        return index < 0 ? [] : [`${source}|${event}|${index}`];
    });
}
function find(node, id) {
    if (!node || node.id === id) {
        return node;
    }
    for (const child of Object.values(node.states ?? {})) {
        const found = find(child, id);
        if (found) {
            return found;
        }
    }
    return null;
}
function routes(micro) {
    return micro
        .flatMap((step) => step.candidates
        .filter((candidate) => candidate.verdict === 'taken')
        .map((candidate) => `${step.eventType}:${candidate.source}>${candidate.targets.join(',')}`))
        .join(' ');
}
function routesOf(trace) {
    return trace
        .map((item) => `${item.eventType}:${item.sourceIds.join(',')}>${item.targetIds.join(',')}`)
        .join(' ');
}
function emptySummary() {
    return {
        runId: '?',
        model: '?',
        agent: 'default',
        startedAt: null,
        endedAt: null,
        tools: [],
        maxToolRounds: null,
        deadline: null,
        status: 'unknown',
        outcome: 'unknown',
        response: '',
        rounds: 0,
        tokens: null,
        machine: null,
        replay: '',
        failure: ''
    };
}
export function activeIds(value, prefix) {
    if (typeof value === 'string') {
        return [`${prefix}.${value}`];
    }
    return isRecord(value)
        ? Object.entries(value).flatMap(([key, child]) => [
            `${prefix}.${key}`,
            ...activeIds(child, `${prefix}.${key}`)
        ])
        : [];
}
function changes(patch, sides) {
    const out = [];
    const walk = ({ patch: node, path, before, after }) => {
        if (!isRecord(node)) {
            return;
        }
        if ('t' in node && Array.isArray(node.a)) {
            out.push({
                path,
                before: undefined,
                after: undefined,
                kept: Number(node.t),
                appended: node.a
            });
            return;
        }
        if ('$' in node || 't' in node) {
            out.push({ path: path || '$', before, after });
            return;
        }
        for (const key of Array.isArray(node.d) ? node.d : []) {
            out.push({ path: join(path, String(key)), before: Object(before)[key], after: undefined });
        }
        for (const [key, child] of Object.entries(isRecord(node.o) ? node.o : {})) {
            const next = { before: Object(before)[key], after: Object(after)[key] };
            if (key !== 'children' || path !== '') {
                walk({ patch: child, path: join(path, key), ...next });
            }
        }
    };
    walk({ patch, path: '', ...sides });
    return out;
}
function isDefinition(value) {
    return isRecord(value) && typeof value.id === 'string' && typeof value.type === 'string';
}
function join(path, key) {
    return path ? `${path}.${key}` : key;
}
