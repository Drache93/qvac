import { spliceFrom } from '../splice.js';
import { carriesRunOnlyText } from '../turns.js';
import { runRound } from './stream.js';
import { roundFold } from './streaming.js';
import { degenerateAnswer } from '../../../helpers/run-outcome.js';
import { stripToolCallMarkup } from '../../../helpers/tool-call-markup.js';
import { materializeCompletionHistory } from '../../tool-turns.js';
import { toolDialectFor } from '../../../models/model-catalog.js';
import { loadedSkills } from '../session.js';
import { CompletionMachine } from '../../../machine/index.js';
export const WRAP_UP_PREDICT = 4096;
export const wrapUp = async function wrapUp({ emit, input: { sdk, args, session, operations }, context }) {
    const { modelId, acquireRound, signal } = args;
    const cacheKey = !args.replaysContext && carriesRunOnlyText(context.history)
        ? undefined
        : (context.cacheKey ?? undefined);
    const promptPrefix = session.reselectTools?.(loadedSkills(context, session)) ?? context.promptPrefix;
    const startedAt = Date.now();
    const recovered = await runRound({
        sdk,
        modelRound: args.modelRound,
        kind: 'wrap-up',
        session,
        args: {
            modelId,
            acquireRound,
            history: context.history,
            failureResults: context.failureResults,
            continuationNudge: context.policy.continuationNudge,
            deliveredNudge: context.policy.deliveredNudge,
            tools: session.sdkTools,
            generationParams: wrapUpParams(session.generationParams),
            toolDialect: args.model ? toolDialectFor(args.model) : undefined,
            cacheKey,
            signal,
            round: context.roundsSent,
            promptPrefix,
            capture: args.captureInferenceCalls === true,
            recordRequest: operations.recordRequest,
            fold: roundFold(args, session, context)
        },
        emit
    });
    const durationMs = Date.now() - startedAt;
    const cutOff = CompletionMachine.atContextBoundary(recovered.final);
    const replay = !cutOff && recovered.replay?.trim() ? stripToolCallMarkup(recovered.replay) : '';
    const contentText = !cutOff && recovered.contentText.trim() ? recovered.contentText : '';
    if (cutOff) {
        emit({
            type: 'round-reset',
            runId: session.runId,
            round: context.roundsSent,
            replacedTypes: ['content', 'thinking']
        });
    }
    const fallbackResponse = degenerateAnswer(wrapOutcome(context), materializeCompletionHistory(context.history, context.failureResults), { ...previewFinishedRound(session.runOutcomes.snapshot()), delivered: context.delivered });
    return {
        contentText,
        thinkingText: '',
        promptPrefix,
        toolCalls: [],
        stats: recovered.final.stats,
        stopReason: recovered.final.stopReason,
        durationMs,
        ctxSize: recovered.ctxSize,
        overflows: recovered.overflows,
        reasoningDeltas: recovered.reasoningDeltas,
        replay,
        history: recovered.history ? spliceFrom(context.history, recovered.history) : undefined,
        cacheable: recovered.cacheable,
        response: replay || contentText || fallbackResponse
    };
};
function wrapUpParams(params) {
    if (!params) {
        return { tool_choice: 'none' };
    }
    const reasoning = Math.max(params.reasoning_budget ?? 0, 0);
    return { predict: reasoning + WRAP_UP_PREDICT, ...params, tool_choice: 'none' };
}
function previewFinishedRound(state) {
    return {
        latestFailure: state.hasRoundResult ? state.roundFailure : state.latestFailure,
        confirmedWrites: state.confirmedWrites
    };
}
function wrapOutcome(ctx) {
    if (ctx.outcome === 'mute' ||
        ctx.outcome === 'exhausted' ||
        ctx.outcome === 'search-capped' ||
        ctx.outcome === 'time-capped' ||
        ctx.outcome === 'delivered') {
        return ctx.outcome;
    }
    return 'exhausted';
}
