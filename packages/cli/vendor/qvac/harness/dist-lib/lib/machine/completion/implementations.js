import { assign, enqueueActions } from 'xstate';
import { approveCompletion, requestApproval } from './actions/approval.js';
import { addKnowledge, answerCompletion, continueGoal, continueStop, continueWithInput, failCompletion, finishWrapRound, finishRound, goalTurn, retryCappedSearch, retryCutRound, retryMalformedRound, retryMuteRound, retryNarratedRound, settleGoal, startInitialRound, startNextRound, wrapCompletion, wrapCutCompletion, wrapDeliveredCompletion, wrapExhaustedCompletion, wrapMuteCompletion, wrapSearchCappedCompletion } from './actions/completion.js';
import { authorizePrepare, requestPrepare, settlePrepare, settlePrepareFailure } from './actions/prepare.js';
import { finishBatch, finishDirectTool, finishTool, endRunOnTool, queueDirectSearch, rejectCutOffTool, rejectDeniedApproval, rejectPlanModeWrite, rejectRepeatedTool, rejectTool, resolveTools, selectNextTool, startDirectTool, startTool } from './actions/tools.js';
import { allResolvedToolsCapped, canMuteRetry, canRetryCut, canRetryMalformed, canRetryNarrated, canRetrySearchCap, hasQueuedTool, hasRoundsLeft, repeatsBlocked, searchPending } from './guards/retry.js';
import { goalMet, goalStalled, goalTokensLeft, leadingReads, runsUnasked } from './rules.js';
function output(event) {
    return ('output' in event ? event.output : {});
}
function errorOf(event) {
    return 'error' in event ? event.error : undefined;
}
function preflightFacts(execution) {
    return execution?.gate?.facts;
}
function preflightReady(execution) {
    const facts = preflightFacts(execution);
    return Boolean(facts && !facts.validationError && !facts.refusal && !facts.deniedKey);
}
function autoRuns(execution) {
    const facts = preflightFacts(execution);
    return Boolean(facts && runsUnasked(facts));
}
function needsApproval(context, execution) {
    return Boolean(preflightReady(execution) &&
        !autoRuns(execution) &&
        context.approval.status === 'idle' &&
        execution?.gate?.approver);
}
export const completionGuards = {
    prepareNeeded: ({ event }) => {
        const step = output(event).step;
        return Boolean(step && step.available && step.effect === 'read' && !step.done);
    },
    prepareFailed: ({ event }) => Boolean(output(event).failure),
    directSearchNeeded: ({ event }) => Boolean(output(event).searchQuery),
    directRejected: ({ event }) => Boolean(output(event).directTool?.rejection),
    directNeedsApproval: ({ context, event }) => needsApproval(context, output(event).directTool?.execution),
    directAutoRuns: ({ event }) => preflightReady(output(event).directTool?.execution) &&
        autoRuns(output(event).directTool?.execution),
    noDirectTool: ({ event }) => !output(event).directTool,
    searchPending: ({ context }) => searchPending(context),
    roundHasToolCalls: ({ event }) => (output(event).calls?.length ?? 0) > 0,
    roundCut: ({ context }) => context.lastRound?.cut !== undefined,
    canRetryCut: ({ context }) => canRetryCut(context),
    malformedToolCall: ({ context, event }) => canRetryMalformed(context) && Boolean(output(event).malformed),
    narratedIntent: ({ context, event }) => canRetryNarrated(context) && Boolean(output(event).narrated),
    hasAnswer: ({ event }) => {
        const { response, cutOff } = output(event);
        return !!response?.trim() && !cutOff;
    },
    canMuteRetry: ({ context }) => canMuteRetry(context),
    hasRoundsLeft: ({ context }) => hasRoundsLeft(context),
    hasQueuedTool: ({ context }) => hasQueuedTool(context),
    repeatOfFailed: ({ context }) => {
        const next = context.toolQueue[0];
        return Boolean(next && context.failedCalls[next.key]);
    },
    headCutOff: ({ context }) => Boolean(context.toolQueue[0]?.cutOff),
    readBatchQueued: ({ context }) => leadingReads(context) >= 2,
    batchRan: ({ event }) => (output(event).results?.length ?? 0) > 0,
    toolAnswered: ({ context }) => context.answer !== null,
    deliveredBefore: ({ context }) => context.delivered,
    repeatsBlocked: ({ context }) => repeatsBlocked(context),
    allResolvedToolsCapped: ({ context }) => allResolvedToolsCapped(context),
    canRetrySearchCap: ({ context }) => canRetrySearchCap(context),
    toolRejected: ({ event }) => Boolean(output(event).rejection),
    planModeWrite: ({ context, event }) => {
        const { call, execution } = output(event);
        return context.planMode && preflightFacts(execution)?.effect === 'write' && !call?.leavesPlan;
    },
    approved: ({ event }) => output(event).approved === true,
    needsApproval: ({ context }, execution) => needsApproval(context, execution),
    toolAutoRuns: ({ event }) => preflightReady(output(event).execution) &&
        autoRuns(output(event).execution),
    directExecution: ({ context }) => context.execution?.kind === 'direct',
    toolEndedRun: ({ event }) => output(event).endedRun === true,
    timeUp: ({ context }) => context.timeUp,
    failedOutcome: ({ context }) => context.outcome === 'failed',
    hasInput: ({ context }) => context.steering.length + context.followUps.length > 0,
    stopContinues: ({ event }) => Boolean(output(event).continue),
    goalUnmet: ({ context }) => context.goal !== null && !goalMet(context),
    goalTokensLeft: ({ context }) => goalTokensLeft(context),
    goalStalled: ({ context }) => goalStalled(context),
    needsRecovery: ({ event }) => errorOf(event)?.tag === 'recovery',
    interrupted: ({ event }) => errorOf(event)?.tag === 'aborted'
};
export const completionActions = {
    requestPrepare: assignAction(requestPrepare),
    authorizePrepare: assignAction(authorizePrepare),
    settlePrepareFailure: assignAction(settlePrepareFailure),
    settlePrepare: assignAction(settlePrepare),
    startDirectTool: assignAction(startDirectTool),
    queueDirectSearch: assignAction(queueDirectSearch),
    rejectDeniedApproval: assignAction(rejectDeniedApproval),
    startInitialRound: assignAction(startInitialRound),
    finishRound: assignAction(finishRound),
    finishWrapRound: assignAction(finishWrapRound),
    wrapCompletion: assignAction(wrapCompletion),
    resolveTools: assignAction(resolveTools),
    answerCompletion: assignAction(answerCompletion),
    continueWithInput: assignAction(continueWithInput),
    addKnowledge: assignAction(addKnowledge),
    continueStop: assignAction(continueStop),
    continueGoal: goalAction(continueGoal),
    settleGoal: goalAction(settleGoal),
    retryMalformedRound: assignAction(retryMalformedRound),
    retryMuteRound: assignAction(retryMuteRound),
    retryCutRound: assignAction(retryCutRound),
    wrapCutCompletion: assignAction(wrapCutCompletion),
    retryNarratedRound: assignAction(retryNarratedRound),
    wrapMuteCompletion: assignAction(wrapMuteCompletion),
    selectNextTool: assignAction(selectNextTool),
    rejectRepeatedTool: assignAction(rejectRepeatedTool),
    rejectCutOffTool: assignAction(rejectCutOffTool),
    retryCappedSearch: assignAction(retryCappedSearch),
    wrapSearchCappedCompletion: assignAction(wrapSearchCappedCompletion),
    startNextRound: assignAction(startNextRound),
    wrapDeliveredCompletion: assignAction(wrapDeliveredCompletion),
    wrapExhaustedCompletion: assignAction(wrapExhaustedCompletion),
    startTool: assignAction(startTool),
    rejectTool: assignAction(rejectTool),
    rejectPlanModeWrite: assignAction(rejectPlanModeWrite),
    finishDirectTool: assignAction(finishDirectTool),
    finishTool: assignAction(finishTool),
    finishBatch: assignAction(finishBatch),
    endRunOnTool: assignAction(endRunOnTool),
    approveCompletion: assignAction(approveCompletion),
    requestApproval: assignAction(requestApproval),
    failCompletion: assignAction(failCompletion),
    markTimeUp: assignAction(() => ({ timeUp: true })),
    recordPause: assignAction(({ context }) => ({
        pauseCount: context.pauseCount + 1
    })),
    recordRecovery: assign(({ event }) => {
        const error = errorOf(event);
        let recovery;
        if (event.type === 'RECOVERY_REQUIRED') {
            recovery = event.operation;
        }
        else if (error?.tag === 'recovery') {
            recovery = error.operation;
        }
        return {
            recovery
        };
    }),
    resumeRun: assign(({ context, event }) => {
        const pausedMs = event.type === 'RESUME' ? (event.pausedMs ?? 0) : 0;
        const durable = context.durable;
        return {
            recovery: undefined,
            durable: durable && pausedMs > 0
                ? {
                    ...durable,
                    runBudget: {
                        ...durable.runBudget,
                        deadlineMs: durable.runBudget.deadlineMs + pausedMs
                    }
                }
                : durable
        };
    }),
    ackSteering: ackAction(({ context }, params) => context.steering.flatMap((queued) => [
        inputEvent(context.runId, queued, params.round),
        ...contextEvent(context.runId, queued, params.round)
    ])),
    resetCutRound: ackAction(({ context }, params) => params.cutOff
        ? [
            {
                type: 'round-reset',
                runId: context.runId,
                round: context.round,
                replacedTypes: ['content', 'thinking']
            }
        ]
        : []),
    ackInput: ackAction(({ context }) => [...context.steering, ...context.followUps].map((queued) => inputEvent(context.runId, queued, context.round + 1))),
    queueInput: assign(({ context, event }) => {
        if (event.type !== 'INPUT')
            return {};
        const queued = queuedOf(event);
        return event.mode === 'steer'
            ? { steering: [...context.steering, queued] }
            : { followUps: [...context.followUps, queued] };
    }),
    recordFacts: assign(({ event }) => (event.type === 'FACTS' ? { durable: event.value } : {}))
};
function assignAction(action) {
    return assign(({ context }, params) => action({ context, params }));
}
function ackAction(events) {
    return enqueueActions(({ context, enqueue }, params) => {
        for (const event of events({ context }, params)) {
            enqueue.emit(event);
        }
    });
}
function goalAction(action) {
    return enqueueActions(({ context, enqueue }) => {
        const update = action({ context, params: undefined });
        const { goal } = update;
        if (!goal) {
            return;
        }
        enqueue.assign(update);
        const event = {
            type: 'goal',
            runId: context.runId,
            status: goal.status,
            turn: goal.turns,
            round: update.round ?? context.round
        };
        if (goal.status === 'open') {
            event.text = goalTurn(context);
        }
        if (goal.checks.length) {
            event.checks = goal.checks.map(({ name }) => name);
        }
        enqueue.emit(event);
    });
}
function inputEvent(runId, { id, text }, round) {
    return { type: 'input', runId, ...idOf(id), text, round };
}
function contextEvent(runId, { id, context }, round) {
    return context ? [{ type: 'context', runId, ...idOf(id), context, round }] : [];
}
function queuedOf({ id, text, context, content }) {
    return context === undefined ? { ...idOf(id), text } : { ...idOf(id), text, context, content };
}
function idOf(id) {
    return id === undefined ? {} : { id };
}
