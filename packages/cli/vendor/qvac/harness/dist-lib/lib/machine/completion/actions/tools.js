import { activate, applyHistorySplice, applySplice, cutOffMessage, recordTool, retainFailureResults } from '../rules.js';
import { failureResultRef, storeFailureResult, toolDeniedResult } from '../../../helpers/failure-result.js';
import { applyPreparation } from './completion.js';
export function resolveTools({ context, params }) {
    return {
        toolQueue: [...params.calls],
        cappedCalls: 0,
        resolvedCount: params.calls.length,
        ...applyHistorySplice(context, params.history)
    };
}
export function selectNextTool({ params }) {
    return { currentCall: params, rejectedCall: null };
}
export function rejectTool({ context, params }) {
    const { call, execution, rejection } = params;
    const memoized = memoizedFailure({
        context,
        call,
        result: rejection.result,
        outcome: rejection.outcome
    });
    return {
        currentCall: call,
        execution,
        failureResults: memoized.failureResults ?? context.failureResults,
        rejectedCall: rejectionPayload({
            call,
            ...memoized.value,
            activity: rejection.activity,
            effect: rejection.effect,
            outcome: rejection.outcome,
            deniedKey: rejection.deniedKey,
            emitCall: rejection.emitCall ?? true,
            emitResult: rejection.emitResult ?? true,
            capped: rejection.capped ?? false,
            source: rejection.source,
            repeat: rejection.repeat
        })
    };
}
export function rejectDeniedApproval({ context, params }) {
    const { call, execution } = params;
    const facts = execution.gate.facts;
    const result = toolDeniedResult(context.policy.deniedMessage);
    return {
        pendingCall: null,
        approval: { status: 'denied', key: context.approval.key },
        rejectedCall: {
            call,
            result,
            activity: {
                type: 'tool-activity',
                name: call.name,
                args: call.args,
                resource: facts.resource,
                effect: facts.effect,
                decision: 'denied'
            },
            effect: facts.effect,
            outcome: { kind: 'denied', reason: result.error },
            deniedKey: facts.key,
            emitCall: false,
            emitResult: true,
            capped: false,
            source: execution.origin
        }
    };
}
function memoizedFailure({ context, call, result, outcome }) {
    if (!outcome || outcome.kind === 'denied') {
        return { value: { result } };
    }
    const ref = failureResultRef(call.key, context.round, call.id);
    const value = {
        name: call.name,
        result: storeFailureResult(result)
    };
    const prior = context.failureResults[ref];
    if (prior) {
        throw new Error(`Failure result reference collision: ${ref}`);
    }
    return {
        value: { resultRef: ref },
        failureResults: { ...context.failureResults, [ref]: value }
    };
}
function rejectionPayload(payload) {
    const result = payload.resultRef === undefined ? { result: payload.result } : { resultRef: payload.resultRef };
    return {
        call: payload.call,
        ...result,
        activity: payload.activity,
        effect: payload.effect,
        outcome: payload.outcome,
        deniedKey: payload.deniedKey,
        emitCall: payload.emitCall,
        emitResult: payload.emitResult,
        capped: payload.capped,
        source: payload.source,
        repeat: payload.repeat
    };
}
export function queueDirectSearch({ context, params }) {
    return {
        ...applyPreparation(context, params.preparation),
        pendingSearch: params.searchQuery
    };
}
export function startDirectTool({ params }) {
    return {
        currentCall: params.call,
        execution: params.execution
    };
}
export function startTool({ params }) {
    return { execution: params, pendingCall: null };
}
export function finishTool({ context, params }) {
    return {
        ...applyToolResult(context, params, context.currentCall),
        ...roundResult(context, params),
        toolQueue: context.toolQueue.slice(1)
    };
}
export function finishBatch({ context, params }) {
    let settled = {
        ...context,
        history: applySplice(context.history, params.history)
    };
    params.results.forEach((result, at) => {
        settled = {
            ...settled,
            ...applyToolResult(settled, result, context.toolQueue[at]),
            ...roundResult(settled, result)
        };
    });
    return { ...settled, toolQueue: context.toolQueue.slice(params.results.length) };
}
export function endRunOnTool(args) {
    return { ...finishTool(args), outcome: 'tool-ended' };
}
export function finishDirectTool({ context, params }) {
    return { ...applyToolResult(context, params, context.currentCall), directSearchDone: true };
}
function roundResult(context, payload) {
    return {
        answer: context.answer ?? payload.answer ?? null,
        deliveredThisRound: context.deliveredThisRound || payload.delivered === true
    };
}
function unchangedRound(context, payload) {
    const folded = payload.settled ? context.settledResults[payload.settled.key]?.folded : undefined;
    return (payload.unchanged === true &&
        !folded &&
        !Object.entries(context.settledResults).some(([key, { repeats, round }]) => key !== payload.settled?.key && round === context.round && repeats > 0));
}
function settledSince(settled) {
    return Object.fromEntries(Object.entries(settled).map(([key, result]) => [key, { ...result, repeats: 0 }]));
}
function failureStreaks(context, payload) {
    const streaks = context.failureStreaks;
    if (payload.failed) {
        return { ...streaks, [payload.failed.key]: (streaks?.[payload.failed.key] ?? 0) + 1 };
    }
    if (streaks && payload.settled && payload.settled.key in streaks) {
        const { [payload.settled.key]: _cleared, ...rest } = streaks;
        return rest;
    }
    return streaks;
}
function applyToolResult(context, payload, call) {
    const failedCalls = payload.failed
        ? {
            ...context.failedCalls,
            [payload.failed.key]: {
                resultRef: payload.failed.resultRef,
                outcome: payload.failed.outcome
            }
        }
        : context.failedCalls;
    const failureResults = payload.failed?.value
        ? { ...context.failureResults, [payload.failed.resultRef]: payload.failed.value }
        : context.failureResults;
    if (payload.failed && !failureResults[payload.failed.resultRef]) {
        throw new Error(`Missing canonical failure result: ${payload.failed.resultRef}`);
    }
    const history = applySplice(context.history, payload.history);
    return {
        history,
        failureResults: retainFailureResults(history, failureResults, failedCalls),
        sources: payload.source ? [...context.sources, payload.source] : context.sources,
        deniedKeys: payload.deniedKey && !context.deniedKeys.includes(payload.deniedKey)
            ? [...context.deniedKeys, payload.deniedKey]
            : context.deniedKeys,
        failedCalls,
        blockedRepeats: context.blockedRepeats + (payload.blockedRepeat || unchangedRound(context, payload) ? 1 : 0),
        failureStreaks: failureStreaks(context, payload),
        settledResults: payload.settled
            ? {
                ...(payload.progressed ? settledSince(context.settledResults) : context.settledResults),
                [payload.settled.key]: {
                    digest: payload.settled.digest,
                    repeats: payload.unchanged
                        ? (context.settledResults[payload.settled.key]?.repeats ?? 0) + 1
                        : 0,
                    round: context.round
                }
            }
            : context.settledResults,
        answeredReads: answeredReads(context, payload),
        roundProgressed: context.roundProgressed || payload.progressed === true,
        webSearches: context.webSearches + (payload.webSearch ? 1 : 0),
        cappedCalls: context.cappedCalls + (payload.searchCapped ? 1 : 0),
        metrics: recordTool(context, call, payload.durationMs),
        activated: activate(context.activated, payload.activate ? [payload.activate] : []),
        plan: payload.plan ?? context.plan,
        goal: applyChecks(context.goal, payload.checked),
        planMode: context.planMode && payload.leftPlanMode !== true,
        pendingCall: null,
        approval: { status: 'idle', key: null },
        currentCall: null,
        execution: null,
        rejectedCall: null
    };
}
function answeredReads(context, payload) {
    const memo = context.answeredReads ?? [];
    if (payload.stableRead) {
        return payload.settled && !memo.includes(payload.settled.key)
            ? [...memo, payload.settled.key]
            : context.answeredReads;
    }
    return payload.durationMs === undefined || !memo.length ? context.answeredReads : [];
}
export function rejectRepeatedTool({ params }) {
    const { call, prior } = params;
    return {
        currentCall: call,
        rejectedCall: {
            call,
            resultRef: prior.resultRef,
            activity: null,
            emitCall: false,
            emitResult: false,
            capped: false,
            source: 'tool-result',
            repeat: prior.outcome
        }
    };
}
export function rejectCutOffTool({ context, params }) {
    return {
        currentCall: params,
        rejectedCall: {
            call: params,
            result: { error: cutOffMessage(context.policy, context.lastRound), guidance: true },
            activity: null,
            emitCall: true,
            emitResult: true,
            capped: false,
            source: 'tool-result'
        }
    };
}
export const PLAN_MODE_REFUSAL = 'Plan mode: this write was not run. Call update_plan with your steps and submit true to ask ' +
    'the user to approve the plan; writes run once they do.';
export function rejectPlanModeWrite({ params }) {
    const { call, execution } = params;
    return {
        currentCall: call,
        execution,
        rejectedCall: {
            call,
            result: { error: PLAN_MODE_REFUSAL, guidance: true },
            activity: {
                type: 'tool-activity',
                name: call.name,
                args: call.args,
                resource: execution.gate.facts.resource,
                effect: 'write',
                decision: 'blocked'
            },
            effect: 'write',
            emitCall: true,
            emitResult: true,
            capped: false,
            source: execution.origin
        }
    };
}
function applyChecks(goal, checked) {
    if (!goal || !checked) {
        return goal;
    }
    return {
        ...goal,
        checks: goal.checks.map((check) => checked.find(({ name }) => name === check.name) ?? check)
    };
}
