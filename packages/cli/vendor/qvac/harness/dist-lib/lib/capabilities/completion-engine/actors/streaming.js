import { spliceFrom } from '../splice.js';
import { carriesRunOnlyText } from '../turns.js';
import { runRound } from './stream.js';
import { foldTokens } from '../round.js';
import { truncateAtControlToken } from '../../../helpers/control-tokens.js';
import { clipRawCall, recoverMarkupToolCalls, recoverPrintedSkillLoad, recoverSkillNamedCall, stripToolResponseBlocks } from '../../../helpers/tool-call-markup.js';
import { unquoteArg } from '../../../helpers/model-args.js';
import { Agent } from '../../../agent/index.js';
import { loadedTools } from '../../sdk-tool.js';
import { FILE_DELIVERED_NUDGE, GOAL_CONTINUATION_NUDGE, TOOL_CONTINUATION_NUDGE } from '../../tool-turns.js';
import { HarnessLog } from '../../../log.js';
import { toolDialectFor } from '../../../models/model-catalog.js';
import { loadedSkills } from '../session.js';
import { CompletionMachine } from '../../../machine/index.js';
export const streaming = async function streaming({ emit, input: { sdk, args, session, operations }, context }) {
    const { recovered, promptPrefix, thinkingText, durationMs } = await generateStreamingRound({
        sdk,
        args,
        session,
        operations,
        context,
        emit
    });
    const { toolCalls, toolErrors } = roundCalls({ recovered, session, context });
    session.runOutcomes.finishRound();
    session.runOutcomes.beginRound();
    return {
        contentText: recovered.contentText,
        thinkingText,
        toolCalls: toolCalls.map((call) => ({
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            raw: call.raw
        })),
        toolErrors,
        stats: recovered.final.stats,
        stopReason: recovered.final.stopReason,
        durationMs,
        ctxSize: recovered.ctxSize,
        overflows: recovered.overflows,
        reasoningDeltas: recovered.reasoningDeltas,
        promptPrefix,
        replay: recovered.replay,
        history: recovered.history ? spliceFrom(context.history, recovered.history) : undefined,
        cacheable: recovered.cacheable,
        cut: recovered.cut
    };
};
function roundCalls({ recovered, session, context }) {
    const calls = recoverToolCalls({ recovered, session, round: context.round });
    const toolCalls = identifyToolCalls(calls, session.runId, context.round);
    const sdkErrors = recovered.final.toolErrors ?? [];
    if (!calls.length) {
        return { toolCalls, toolErrors: roundToolErrors(sdkErrors) };
    }
    const cut = CompletionMachine.cutShort({
        stopReason: recovered.final.stopReason,
        cut: recovered.cut
    });
    return { toolCalls, toolErrors: cut ? roundToolErrors(sdkErrors) : undefined };
}
function roundToolErrors(errors) {
    if (!errors.length)
        return undefined;
    return errors.map(({ code, message, raw }) => ({
        code,
        message,
        raw: raw === undefined ? undefined : clipRawCall(raw)
    }));
}
async function generateStreamingRound({ sdk, args, session, operations, context, emit }) {
    const prepared = prepareStreamingRound({ args, session, operations, context });
    let thinkingText = '';
    const recovered = await runRound({
        sdk,
        modelRound: args.modelRound,
        kind: 'streaming',
        session,
        args: prepared.args,
        emit: (event) => {
            if (event.type === 'thinking') {
                thinkingText += event.text;
            }
            else if (event.type === 'round-reset') {
                thinkingText = '';
            }
            emit(event);
        }
    });
    const durationMs = Date.now() - prepared.startedAt;
    logRoundStats({ round: context.round, durationMs, recovered });
    return { recovered, promptPrefix: prepared.promptPrefix, thinkingText, durationMs };
}
function logRoundStats({ round, durationMs, recovered }) {
    HarnessLog.debug('round stats', Object.assign({ round, wallMs: durationMs }, recovered.final.stats));
}
function prepareStreamingRound({ args, session, operations, context }) {
    const { modelId, acquireRound, responseFormat, signal } = args;
    const cacheKey = !args.replaysContext && carriesRunOnlyText(context.history)
        ? undefined
        : (context.cacheKey ?? undefined);
    const model = args.model;
    const toolDialect = model ? toolDialectFor(model) : undefined;
    const promptPrefix = session.reselectTools?.(loadedSkills(context, session)) ?? context.promptPrefix;
    HarnessLog.debug('round start', {
        round: context.round,
        turns: context.history.length,
        tools: session.sdkTools?.length ?? 0,
        promptPrefix
    });
    const startedAt = Date.now();
    return {
        args: {
            modelId,
            acquireRound,
            history: context.history,
            failureResults: context.failureResults,
            continuationNudge: context.policy.continuationNudge,
            deliveredNudge: context.policy.deliveredNudge,
            tools: session.sdkTools,
            ...roundGenerationParams(context, session, responseFormat),
            responseFormat,
            toolDialect,
            cacheKey,
            signal,
            round: context.round,
            runId: session.runId,
            promptPrefix,
            capture: args.captureInferenceCalls === true,
            recordRequest: operations.recordRequest,
            fold: roundFold(args, session, context)
        },
        promptPrefix,
        startedAt
    };
}
export function roundFold(args, session, context) {
    const { lastRound } = context;
    return {
        messages: args.messages,
        nudge: context.policy.continuationNudge,
        ctxSize: args.ctxSize,
        cacheKey: carriesRunOnlyText(context.history) ? undefined : args.cacheKey,
        instructions: (messages) => session.pipeline.preFold({ runId: session.runId, agentId: context.agentId, messages }),
        reading: lastRound
            ? {
                cacheTokens: foldTokens(lastRound.stats, lastRound.cacheable),
                ctxSize: lastRound.ctxSize ?? context.metrics.ctxSize,
                cutOff: CompletionMachine.atContextBoundary(lastRound)
            }
            : undefined
    };
}
function roundGenerationParams(context, session, responseFormat) {
    const params = planned(context, session.generationParams);
    const owesCall = context.narrated || (context.malformed && context.lastRound?.stopReason !== 'length');
    if (!owesCall ||
        !session.sdkTools?.length ||
        responseFormat ||
        loadedTools(context.history).size > 0) {
        return { generationParams: params };
    }
    return {
        generationParams: { ...params, reasoning_budget: 0, tool_choice: 'required' },
        unforced: { generationParams: params }
    };
}
function planned(context, params) {
    if (params?.reasoning_rounds !== 'plan') {
        return params;
    }
    return plans(context.history) ? params : { ...params, reasoning_budget: 0 };
}
const NUDGES = new Set([TOOL_CONTINUATION_NUDGE, FILE_DELIVERED_NUDGE, GOAL_CONTINUATION_NUDGE]);
const FAILED_RESULT = /"error"\s*:|"exitCode"\s*:\s*[1-9]/;
function plans(history) {
    for (const entry of [...history].reverse()) {
        if (!('role' in entry)) {
            return true;
        }
        if (entry.role === 'assistant') {
            return false;
        }
        const text = typeof entry.content === 'string' ? entry.content : null;
        if (entry.role === 'user' && (text === null || !NUDGES.has(text))) {
            return true;
        }
        if (entry.role === 'tool' && text !== null && FAILED_RESULT.test(text)) {
            return true;
        }
    }
    return true;
}
function recoverToolCalls({ recovered, session, round }) {
    const markup = stripToolResponseBlocks(truncateAtControlToken(recovered.final.raw.fullText) || recovered.unproven || '');
    let calls = recovered.final.toolCalls?.length
        ? recovered.final.toolCalls
        : recoverMarkupToolCalls(markup, session.enabled);
    if (!calls.length) {
        calls = recoverPrintedSkill(markup, session, round);
    }
    if (!calls.length) {
        calls = recoverNamedSkill(markup, session, round);
    }
    return calls;
}
function recoverPrintedSkill(markup, session, round) {
    if (!session.enabled.some((tool) => tool.name === Agent.SKILL_TOOL_NAME)) {
        return [];
    }
    const rescued = recoverPrintedSkillLoad(markup, Agent.SKILL_TOOL_NAME);
    const rescuedArgs = rescued[0]?.arguments;
    const alreadyLoaded = rescuedArgs !== undefined &&
        (session.loadedSkillFiles
            .get(unquoteArg(rescuedArgs.name))
            ?.has(unquoteArg(rescuedArgs.file)) ??
            false);
    if (alreadyLoaded) {
        return [];
    }
    if (rescued.length) {
        HarnessLog.info('recovered printed skill load', { round });
    }
    return rescued;
}
function recoverNamedSkill(markup, session, round) {
    if (!session.enabled.some((tool) => tool.name === Agent.SKILL_TOOL_NAME)) {
        return [];
    }
    const calls = recoverSkillNamedCall(markup, session.inContextSkills
        .filter((skill) => !session.nudgedSkills.has(skill.name))
        .map((skill) => skill.name), Agent.SKILL_TOOL_NAME);
    for (const call of calls) {
        session.nudgedSkills.add(unquoteArg(call.arguments.name));
    }
    if (calls.length) {
        HarnessLog.info('recovered skill-named call', { round });
    }
    return calls;
}
function identifyToolCalls(calls, runId, round) {
    const seen = new Set();
    return calls.map((call, index) => {
        let id = call.id;
        if (typeof id !== 'string' || !id.trim() || seen.has(id)) {
            let collision = 0;
            do {
                id = generatedId(index, collision++);
            } while (seen.has(id));
        }
        seen.add(id);
        return id === call.id ? call : { ...call, id };
    });
    function generatedId(index, collision = 0) {
        const suffix = collision ? `-${collision}` : '';
        return `${runId}:round-${round}:call-${index + 1}${suffix}`;
    }
}
