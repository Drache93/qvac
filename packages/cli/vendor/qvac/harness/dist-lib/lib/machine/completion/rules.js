import { isFailureResultReference } from '../../helpers/failure-result.js';
import { GOAL_CHECKS_ASK, GOAL_PROOF_ASK } from '../../helpers/goal-check.js';
export function runsUnasked(facts) {
    if (facts.permission === 'ask')
        return false;
    return (facts.permission === 'allow' ||
        facts.effect === 'read' ||
        facts.autoApprove ||
        facts.skipApprovals);
}
export const MAX_MUTE_ROUNDS = 1;
export const MAX_CUT_ROUNDS = 2;
export const MAX_CAPPED_ROUNDS = 1;
export const MAX_BLOCKED_REPEATS = 3;
export const MAX_UNCHANGED_RESULTS = 3;
export const MAX_ROUND_REPEATS = 3;
export const MAX_ROUND_CALLS = 32;
const PLAN_MARKS = {
    pending: '[ ]',
    in_progress: '[>]',
    done: '[x]'
};
export function nudgeWithPlan(nudge, plan) {
    if (plan.every(isDone)) {
        return nudge;
    }
    const lines = plan.map(({ step, status }) => `${PLAN_MARKS[status]} ${step}`);
    return `${nudge}\nPlan:\n${lines.join('\n')}`;
}
function isDone(step) {
    return step.status === 'done';
}
function planDone(plan) {
    return plan.length > 0 && plan.every(isDone);
}
export function goalMet({ plan, goal }) {
    const checks = goal?.checks ?? [];
    return (planDone(plan) && (goal?.named || !goal?.checkable) && checks.every((check) => check.passed));
}
export function nudgeWithChecks(nudge, checks, unnamed) {
    if (!checks.length) {
        return unnamed ? `${nudge}\n${GOAL_CHECKS_ASK}` : nudge;
    }
    const asked = unnamed ? `${nudge}\n${GOAL_PROOF_ASK}` : nudge;
    const open = checks.filter((check) => !check.passed);
    if (!open.length) {
        return asked;
    }
    const lines = open.map(({ name, output }) => output === null ? `- ${name}: not run yet` : `- ${name}: failed. Its last output:\n${output}`);
    return (`${asked}\nChecks: the goal is met only once each of these runs as its own command and ` +
        `exits 0, with no pipe or ; after it to hide its exit code.\n${lines.join('\n')}`);
}
export function goalTokensLeft({ goal, metrics }) {
    return !goal || goal.tokens === null || metrics.tokens < goal.tokens;
}
export function goalStalled({ outcome }) {
    return outcome === 'exhausted';
}
export function retainFailureResults(history, values, failedCalls) {
    const retained = new Set();
    for (const entry of history) {
        if (isFailureResultReference(entry)) {
            retained.add(entry.ref);
        }
    }
    for (const call of Object.values(failedCalls)) {
        retained.add(call.resultRef);
    }
    const keys = Object.keys(values);
    if (keys.every((key) => retained.has(key))) {
        return { ...values };
    }
    return Object.fromEntries(keys.filter((key) => retained.has(key)).map((key) => [key, values[key]]));
}
export function activate(activated, names) {
    const added = names.filter((name, at) => !activated.includes(name) && names.indexOf(name) === at);
    return added.length ? [...activated, ...added] : activated;
}
export function applyHistorySplice(context, splice, options = {}) {
    const failedCalls = options.failedCalls ?? context.failedCalls;
    const failureResults = options.failureResults ?? context.failureResults;
    const history = applySplice(context.history, splice);
    return {
        history,
        failureResults: retainFailureResults(history, failureResults, failedCalls)
    };
}
export function foldMetrics(state, round, finished) {
    const { stats, stopReason } = finished;
    state.stopReason = stopReason;
    state.rounds = [...state.rounds, roundSpeed(round, finished)];
    if (finished.ctxSize) {
        state.ctxSize = finished.ctxSize;
    }
    if (!stats) {
        return;
    }
    if (state.ttft === undefined && stats.timeToFirstToken) {
        state.ttft = stats.timeToFirstToken;
    }
    if (stats.generatedTokens) {
        state.tokens += stats.generatedTokens;
        if (stats.tokensPerSecond) {
            state.decodeMs += (stats.generatedTokens / stats.tokensPerSecond) * 1000;
            state.timedTokens += stats.generatedTokens;
        }
    }
    if (stats.promptTokens) {
        state.promptTokens = stats.promptTokens;
    }
    if (stats.cacheTokens) {
        state.cacheTokens = stats.cacheTokens;
    }
}
const ROUND_STATS = [
    'promptTokens',
    'cacheTokens',
    'generatedTokens',
    'promptTokensPerSecond',
    'tokensPerSecond',
    'timeToFirstToken'
];
function roundSpeed(round, { stats, stopReason, durationMs, overflows, reasoningDeltas }) {
    const speed = { round, durationMs: durationMs ?? 0 };
    for (const key of ROUND_STATS) {
        const value = stats?.[key];
        if (value !== undefined) {
            speed[key] = value;
        }
    }
    if (stopReason) {
        speed.stopReason = stopReason;
    }
    if (overflows) {
        speed.overflows = overflows;
    }
    if (atContextBoundary({ stats, stopReason })) {
        speed.contextBoundary = true;
    }
    if (reasoningDeltas) {
        speed.reasoningDeltas = reasoningDeltas;
    }
    return speed;
}
export function atContextBoundary({ stats, stopReason }) {
    return stopReason === 'length' && stats?.contextBoundary !== false;
}
export function cutShort(round) {
    return round.stopReason === 'length' || round.cut !== undefined;
}
export function cutOffMessage(policy, round) {
    if (round?.cut !== undefined)
        return policy.roundCutMessage;
    return round && atContextBoundary(round) ? policy.contextBoundaryMessage : policy.cutOffMessage;
}
export function recordTool(context, call, durationMs) {
    if (durationMs === undefined || !call) {
        return context.metrics;
    }
    const tool = { round: context.round, name: call.name, durationMs };
    return { ...context.metrics, tools: [...context.metrics.tools, tool] };
}
export function leadingReads(context) {
    const keys = new Set();
    for (const call of context.toolQueue) {
        if (!call.concurrent || call.cutOff || keys.has(call.key) || context.failedCalls[call.key]) {
            break;
        }
        keys.add(call.key);
    }
    return keys.size;
}
export function applySplice(history, splice) {
    if (!splice) {
        return history;
    }
    if (splice.at === history.length && !splice.messages.length) {
        return history;
    }
    return [...history.slice(0, splice.at), ...splice.messages];
}
