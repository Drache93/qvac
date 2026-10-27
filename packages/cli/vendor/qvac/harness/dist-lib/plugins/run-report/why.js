import { getMicrosteps } from 'xstate';
import { evaluateGuard } from 'xstate/guards';
import { CompletionMachine } from '../../lib/machine/index.js';
import { errorMessage, isRecord } from '../../lib/guards.js';
export function decide(machine, before, event) {
    const steps = getMicrosteps(machine, before, event);
    let previous = before;
    return steps.map(([after], index) => {
        const point = { machine, snapshot: previous, event };
        const step = {
            eventType: index === 0 ? event.type : '',
            before: previous,
            after,
            candidates: candidates(point, index === 0)
        };
        previous = after;
        return step;
    });
}
function candidates(point, triggered) {
    const out = [];
    const seen = new Set();
    for (const leaf of leafIds(point.snapshot.value, point.machine.root.id)) {
        let chosen = false;
        for (const route of routes(point.machine.getStateNodeById(leaf), point.event, triggered)) {
            if (seen.has(route.key)) {
                continue;
            }
            seen.add(route.key);
            const candidate = weigh(point, { ...route, shadowed: chosen });
            chosen ||= candidate.verdict === 'taken';
            out.push(candidate);
        }
    }
    return out;
}
function routes(leaf, event, triggered) {
    const out = [];
    for (let node = leaf; node; node = node.parent) {
        const kind = triggered ? event.type : 'always';
        const list = triggered ? (node.transitions.get(event.type) ?? []) : (node.always ?? []);
        const id = node.id;
        out.push(...list.map((transition, index) => ({
            key: `${id}|${kind}|${index}`,
            transition,
            shadowed: false
        })));
    }
    return out;
}
function weigh(point, { key, transition, shadowed }) {
    const guard = transition.guard ? CompletionMachine.transitionName(transition.guard) : null;
    const base = {
        key,
        source: transition.source.id,
        targets: (transition.target ?? []).map((node) => node.id),
        guard,
        parts: [],
        facts: ''
    };
    if (shadowed) {
        return { ...base, verdict: 'unchecked', value: null };
    }
    if (!transition.guard) {
        return { ...base, verdict: 'taken', value: true };
    }
    try {
        const value = check(transition.guard, point);
        const parts = subGuards(transition.guard).map((sub) => ({
            name: CompletionMachine.transitionName(sub),
            value: tryCheck(sub, point)
        }));
        const facts = [guard ?? '', ...parts.map((part) => part.name)]
            .map((name) => factsFor(name, point))
            .filter(Boolean)
            .join(' · ');
        return { ...base, parts, facts, verdict: value ? 'taken' : 'rejected', value };
    }
    catch (error) {
        return { ...base, verdict: 'unevaluable', value: null, error: errorMessage(error) };
    }
}
function check(guard, { snapshot, event }) {
    return evaluateGuard(guard, snapshot.context, event, snapshot);
}
function tryCheck(guard, point) {
    try {
        return check(guard, point);
    }
    catch {
        return null;
    }
}
function subGuards(guard) {
    const guards = Reflect.get(Object(guard), 'guards');
    return Array.isArray(guards) ? guards : [];
}
function leafIds(value, prefix) {
    if (typeof value === 'string') {
        return [`${prefix}.${value}`];
    }
    return isRecord(value)
        ? Object.entries(value).flatMap(([key, child]) => leafIds(child, `${prefix}.${key}`))
        : [prefix];
}
const PREVIEW = 80;
function preview(text) {
    const flat = String(text ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    return flat.length > PREVIEW ? `${flat.slice(0, PREVIEW)}…` : flat;
}
function names(list) {
    const items = Array.isArray(list) ? list : [];
    const named = items.map((item) => String(Object(item).name ?? '?'));
    return `${named.length} call${named.length === 1 ? '' : 's'}${named.length ? `: ${named.join(', ')}` : ''}`;
}
const FACTS = {
    roundHasToolCalls: (_, output) => names(output.calls),
    hasAnswer: (_, output) => output.response ? `answer "${preview(output.response)}"` : 'no answer text',
    hasQueuedTool: (context) => `queue ${names(context.toolQueue)}`,
    hasRoundsLeft: (context) => `next round ${Number(context.round) + 2} of ${Object(context.policy).maxToolRounds}`,
    canMuteRetry: (context) => `mute retries used ${context.mute}`,
    timeUp: (context) => `time up: ${context.timeUp}`,
    toolAnswered: (context) => `answer ${context.answer === null ? 'none yet' : 'set'}`,
    deliveredBefore: (context) => `delivered ${context.delivered}`,
    headCutOff: (context) => `head call cut off ${Object(Object(context.toolQueue)[0]).cutOff === true}`,
    approved: (_, output) => `approved ${output.approved}`,
    toolRejected: (_, output) => output.rejection ? `rejected: ${rejection(output.rejection)}` : 'not rejected',
    needsApproval: (context, output) => `${gateFacts(output)}, approval ${Object(context.approval).status}`,
    toolAutoRuns: (_, output) => gateFacts(output),
    toolEndedRun: (_, output) => `ended run ${output.endedRun === true}`,
    prepareNeeded: (_, output) => `prepare step ${output.step ? preview(JSON.stringify(output.step)) : 'none'}`,
    directSearchNeeded: (_, output) => `search ${output.searchQuery ? `"${preview(output.searchQuery)}"` : 'none'}`,
    hasInput: (context) => `steering ${length(context.steering)}, follow-ups ${length(context.followUps)}`
};
function rejection(value) {
    const body = Object(value);
    const reason = [
        Object(body.outcome).message,
        Object(body.outcome).reason,
        Object(body.result).error
    ];
    return preview(reason.find((item) => typeof item === 'string') ?? JSON.stringify(value));
}
function length(list) {
    return Array.isArray(list) ? list.length : 0;
}
function gateFacts(output) {
    const gate = Object(Object(output.execution).gate);
    const facts = Object(gate.facts);
    return [
        `effect ${facts.effect ?? '?'}`,
        `permission ${facts.permission ?? 'none'}`,
        `autoApprove ${facts.autoApprove === true}`,
        `approver ${gate.approver ? 'present' : 'absent'}`
    ].join(', ');
}
function factsFor(name, { snapshot, event }) {
    const summary = FACTS[name];
    if (!summary) {
        return '';
    }
    try {
        return summary(Object(snapshot.context), Object(event.output));
    }
    catch {
        return '';
    }
}
