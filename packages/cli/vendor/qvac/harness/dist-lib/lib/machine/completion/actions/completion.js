import { hasRoundsLeft } from '../guards/retry.js';
import { mergeChecks, namedChecks } from '../../../helpers/goal-check.js';
import { activate, applyHistorySplice, applySplice, foldMetrics, goalMet, goalStalled, goalTokensLeft, nudgeWithChecks, nudgeWithPlan, retainFailureResults } from '../rules.js';
export function startInitialRound({ context, params }) {
    return applyPreparation(context, params);
}
export function startNextRound({ context }) {
    return {
        ...applyPreparation(context),
        ...closeFailureMemo(context),
        ...endToolRound(context),
        round: context.round + 1,
        mute: 0,
        cuts: 0,
        narrated: false,
        malformed: false,
        cappedRounds: 0
    };
}
export function retryMuteRound(args) {
    const { context } = args;
    return {
        ...silentTurn(args, muteReAsk(context)),
        mute: context.mute + 1,
        round: context.round + 1
    };
}
function muteReAsk(context) {
    return context.goal && !context.steering.length && !goalMet(context)
        ? [{ role: 'user', content: goalTurn(context) }]
        : continuation(context);
}
function silentTurn({ context, params }, reAsk = continuation(context)) {
    if (params.cutOff) {
        return {};
    }
    return {
        history: [
            ...context.history,
            { role: 'assistant', content: params.response?.trim() ?? '' },
            ...reAsk
        ],
        steering: []
    };
}
export function retryNarratedRound({ context, params }) {
    return {
        narrated: true,
        history: [
            ...context.history,
            { role: 'assistant', content: params.narrated ?? '' },
            ...continuation(context)
        ],
        steering: [],
        round: context.round + 1
    };
}
export function retryMalformedRound({ context, params }) {
    return {
        ...applyHistorySplice(context, params.history),
        malformed: true,
        round: context.round + 1
    };
}
export function retryCappedSearch({ context }) {
    return {
        ...applyPreparation(context),
        ...closeFailureMemo(context),
        ...endToolRound(context),
        round: context.round + 1,
        mute: 0,
        cuts: 0,
        narrated: false,
        malformed: false,
        cappedRounds: context.cappedRounds + 1
    };
}
export function retryCutRound({ context }) {
    return { ...cutTurns(context), cuts: context.cuts + 1, round: context.round + 1 };
}
export function wrapCutCompletion({ context }) {
    return { ...cutTurns(context), outcome: 'mute' };
}
function cutTurns(context) {
    const said = context.lastRound?.contentText.trim();
    return {
        history: [
            ...context.history,
            ...(said ? [{ role: 'assistant', content: said }] : []),
            ...userTurns(context.steering)
        ],
        steering: []
    };
}
function closeFailureMemo(context) {
    if (!context.roundProgressed)
        return {};
    return {
        failedCalls: {},
        failureResults: retainFailureResults(context.history, context.failureResults, {}),
        blockedRepeats: 0,
        roundProgressed: false
    };
}
function endToolRound(context) {
    return {
        history: [...context.history, ...continuation(context)],
        steering: [],
        delivered: context.delivered || context.deliveredThisRound,
        deliveredThisRound: false
    };
}
function continuation(context) {
    const { policy, deliveredThisRound, plan } = context;
    const nudge = deliveredThisRound ? policy.deliveredNudge : policy.continuationNudge;
    return context.steering.length
        ? userTurns(context.steering)
        : [{ role: 'user', content: nudgeWithPlan(nudge, plan) }];
}
function userTurns(queued) {
    return queued.map(({ text, content }) => ({ role: 'user', content: content ?? text }));
}
function continueAfterAnswer(context, turns) {
    return {
        history: [...context.history, ...turns],
        outcome: null,
        answer: null,
        round: context.round + 1,
        mute: 0,
        cuts: 0,
        narrated: false,
        malformed: false,
        cappedRounds: 0
    };
}
export function continueWithInput({ context }) {
    return {
        ...continueAfterAnswer(context, [
            ...userTurns(context.steering),
            ...userTurns(context.followUps)
        ]),
        steering: [],
        followUps: [],
        edgeInputs: [...context.steering, ...context.followUps]
    };
}
export function addKnowledge({ context, params }) {
    return {
        ...applyHistorySplice(context, params.history),
        sources: params.sources ? [...context.sources, ...params.sources] : context.sources
    };
}
export function goalTurn({ policy, goal, plan }) {
    return nudgeWithChecks(nudgeWithPlan(`${policy.goalNudge}\nGoal: ${goal?.objective ?? ''}`, plan), goal?.checks ?? [], goal?.checkable && !goal.named);
}
export function continueGoal({ context }) {
    const { goal } = context;
    return {
        ...continueAfterAnswer(context, [{ role: 'user', content: goalTurn(context) }]),
        goal: goal && { ...goal, turns: goal.turns + 1 }
    };
}
export function continueStop({ context, params }) {
    return continueAfterAnswer(context, [{ role: 'user', content: params.continue ?? '' }]);
}
export function settleGoal({ context }) {
    const { goal } = context;
    return goal ? { goal: { ...goal, status: goalStatus(context) } } : {};
}
function goalStatus(context) {
    if (goalMet(context)) {
        return 'met';
    }
    if (!hasRoundsLeft(context)) {
        return 'rounds';
    }
    if (context.timeUp) {
        return 'time';
    }
    if (!goalTokensLeft(context)) {
        return 'tokens';
    }
    return goalStalled(context) ? 'stalled' : 'open';
}
export function finishRound({ context, params }) {
    const metrics = { ...context.metrics };
    foldMetrics(metrics, context.round, params);
    const historyState = applyHistorySplice(context, params.history);
    return {
        lastRound: { ...params, history: undefined },
        goal: adoptChecks(context.goal, params.contentText),
        roundsSent: context.round + 1,
        cacheKey: params.cacheable === false ? null : context.cacheKey,
        ...historyState,
        ...settledAfterSend(context, params),
        promptPrefix: params.promptPrefix ?? context.promptPrefix,
        metrics,
        steering: params.cut === undefined ? context.steering : [...context.steering, { text: params.cut }]
    };
}
export function finishWrapRound({ context, params }) {
    const metrics = { ...context.metrics };
    foldMetrics(metrics, context.roundsSent, params);
    const historyState = applyHistorySplice(context, params.history);
    return {
        ...historyState,
        ...settledAfterSend(context, params),
        lastRound: { ...params, history: undefined },
        metrics
    };
}
function adoptChecks(goal, text) {
    if (!goal?.checkable || goal.named) {
        return goal;
    }
    const host = goal.checks.map((check) => check.name);
    const names = mergeChecks(host, namedChecks(text));
    if (!names.length) {
        return goal;
    }
    const checks = names.map((name) => goal.checks.find((check) => check.name === name) ?? { name, passed: false, output: null });
    return { ...goal, checks, named: true };
}
function settledAfterSend(context, params) {
    return params.history && params.history.at < context.history.length
        ? {
            settledResults: Object.fromEntries(Object.entries(context.settledResults).map(([key, result]) => [
                key,
                { ...result, folded: true }
            ])),
            answeredReads: context.answeredReads?.length ? [] : undefined
        }
        : {};
}
export function wrapCompletion({ params }) {
    return { outcome: params };
}
export function wrapMuteCompletion(args) {
    return { ...silentTurn(args), outcome: 'mute' };
}
export function wrapSearchCappedCompletion({ context }) {
    return { ...endToolRound(context), outcome: 'search-capped' };
}
export function wrapDeliveredCompletion({ context }) {
    return { ...endToolRound(context), outcome: 'delivered' };
}
export function wrapExhaustedCompletion({ context }) {
    return { ...endToolRound(context), outcome: 'exhausted' };
}
export function answerCompletion({ context, params }) {
    const historyState = applyHistorySplice(context, params.history);
    const history = historyState.history;
    const metrics = { ...context.metrics };
    if ('stats' in params) {
        foldMetrics(metrics, context.roundsSent, params);
    }
    return {
        ...historyState,
        history: params.response
            ? [...history, { role: 'assistant', content: params.response }]
            : history,
        response: params.response || context.response,
        metrics,
        outcome: metGoalAnswered(context) ? 'answered' : (context.outcome ?? 'answered')
    };
}
function metGoalAnswered(context) {
    const round = context.lastRound;
    return (context.outcome === 'mute' &&
        context.goal !== null &&
        goalMet(context) &&
        Boolean(round?.contentText.trim() || round?.replay?.trim()));
}
export function failCompletion({ params }) {
    const failure = 'tag' in params
        ? params
        : {
            tag: 'failed',
            message: params.error,
            name: 'Error'
        };
    return {
        outcome: 'failed',
        failMessage: failure.message,
        failure
    };
}
export function applyPreparation(context, payload) {
    const historyState = applyHistorySplice(context, payload?.history);
    return {
        ...historyState,
        activated: activate(context.activated, payload?.activated ?? []),
        webSearches: payload?.webSearches ?? context.webSearches,
        deniedKeys: payload?.deniedKeys ? [...payload.deniedKeys] : context.deniedKeys,
        sources: payload?.sources ? [...payload.sources] : context.sources,
        availableTools: payload?.availableTools ? [...payload.availableTools] : context.availableTools,
        promptPrefix: payload?.promptPrefix ?? context.promptPrefix,
        goal: context.goal && payload?.checkable !== undefined
            ? { ...context.goal, checkable: payload.checkable }
            : context.goal,
        currentCall: null,
        execution: null,
        rejectedCall: null,
        toolQueue: [],
        pendingCall: null,
        prepareStep: null,
        pendingSearch: null,
        cappedCalls: 0,
        resolvedCount: 0
    };
}
