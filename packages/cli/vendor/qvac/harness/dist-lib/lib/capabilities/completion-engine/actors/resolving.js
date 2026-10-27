import { Agent } from '../../../agent/index.js';
import { spliceFrom } from '../splice.js';
import { AbortedError } from '../../../helpers/race-abort.js';
import { HarnessLog } from '../../../log.js';
import { MALFORMED_CALL_ID, stripToolCallMarkup } from '../../../helpers/tool-call-markup.js';
import { toolResultTurn } from '../../tool-turns.js';
import { loadTurns, unloadedTools } from '../../sdk-tool.js';
import { assistantToolTurn } from '../turns.js';
import { resolveToolCalls } from '../tool-execution.js';
import { toolContext } from './execution-plan.js';
import { withCatalogSkillName } from '../../tool-plan.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { CompletionMachine } from '../../../machine/index.js';
const REISSUE_HINT = 'Re-issue the tool call with complete, valid markup.';
const REPEATED_CALL_ID = 'call-repeated';
const NARRATED_INTENT = /\b(?:I['’]ll|I will|Now I|Let me(?! know)|Next,? I)\b/i;
const PARAGRAPH = /(?<!:\s*)\n\s*\n(?!\s*(?:[-*+]|\d+[.)])\s)|(?<=[.!?]\s*)\n\s*\n/;
const SENTENCE = /(?<=[.!?])(?<!(?:^|\n)\s*\d+\.)\s+/;
const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
const QUESTION = /\?(?![\w=&%/])/;
const ASKS = /\bplease\s+(?:provide|tell|give|share|send|specify|confirm|let me know)\b|\b(?:tell|send|show)\s+me\b|\bgive\s+me\b(?!\s+(?:just\s+)?(?:a|an|one|two|\d+|a few|a couple(?:\s+of)?|some)\s+(?:moment|sec(?:ond)?|minute|min|bit|while|tick)s?\s*(?:[,.;!…—–]|\s-|$|(?:to|while|and|so|as|then)\b))|\blet me know\b/i;
function narratedIntent(spoken) {
    const prose = spoken.replace(CODE, '').trimEnd();
    const tail = prose.split(PARAGRAPH).at(-1) ?? '';
    const sentences = tail.split(SENTENCE).slice(-2);
    return (sentences.some((sentence) => NARRATED_INTENT.test(sentence)) &&
        !QUESTION.test(prose) &&
        !ASKS.test(prose));
}
export const resolving = async function resolving({ input: deps, context }) {
    const { args, session } = deps;
    const round = context.lastRound;
    const named = round.toolCalls.map((call) => withCatalogSkillName(call, args.skillCatalog ?? []));
    const toolCalls = firstOfEach(named, session).map((call) => ({
        id: call.id,
        name: call.name,
        arguments: call.arguments,
        raw: call.raw
    }));
    if (!toolCalls.length) {
        return answerFacts({ round, context, session });
    }
    const resolved = await resolveToolCalls(toolCalls, session.enabled, {
        runId: session.runId,
        agentId: context.agentId,
        pipeline: session.pipeline,
        skillNames: session.inContextSkills.map((skill) => skill.name),
        network: session.access?.network.mode ?? 'on',
        toolContext: (name) => toolContext({ deps, context, name }),
        signal: args.signal
    });
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const repeated = toolCalls.length < round.toolCalls.length;
    return resolvedOutput({ context, round, resolved, repeated, deps });
};
function firstOfEach(calls, session) {
    const seen = new Set();
    return calls.filter((call) => {
        const key = session.callKey(call.name, call.arguments);
        const first = !seen.has(key);
        seen.add(key);
        return first;
    });
}
function answerFacts({ round, context, session }) {
    const replay = round.replay ? stripToolCallMarkup(round.replay) : '';
    const spoken = round.contentText.trim();
    const cutOff = session.enabled.length > 0 && !replay && CompletionMachine.atContextBoundary(round);
    const narrated = session.enabled.length && !replay && !cutOff && narratedIntent(spoken) ? spoken : undefined;
    if (narrated) {
        HarnessLog.info('round narrated a tool call', { round: context.round });
    }
    if (cutOff) {
        HarnessLog.info('round cut off at the context window', { round: context.round });
    }
    const answer = {
        calls: [],
        response: replay || round.contentText,
        narrated,
        cutOff: cutOff ? true : undefined
    };
    if (!round.toolErrors?.length) {
        return answer;
    }
    HarnessLog.info('round made malformed tool calls', {
        round: context.round,
        errors: round.toolErrors.map((error) => error.code)
    });
    return { ...answer, history: malformedCallTurns({ round, context, session }), malformed: true };
}
function malformedCallTurns({ round, context, session }) {
    const errors = round.toolErrors ?? [];
    const said = [round.contentText.trim(), ...errors.map((error) => error.raw ?? '')];
    const error = CompletionMachine.cutShort(round)
        ? CompletionMachine.cutOffMessage(context.policy, round)
        : [
            ...errors.map(({ code, message }) => `${code}: ${message}`),
            reissueHint(errors, unloadedTools(session.enabled, context.history))
        ].join('\n');
    return spliceFrom(context.history, [
        ...context.history,
        { role: 'assistant', content: said.filter(Boolean).join('\n') },
        { role: 'tool', content: toolResultTurn('tool_call', MALFORMED_CALL_ID, { error }) },
        { role: 'user', content: context.policy.continuationNudge }
    ]);
}
function reissueHint(errors, unloaded) {
    const named = [...unloaded].filter((name) => errors.some(({ code, message }) => code === 'UNKNOWN_TOOL' && message.includes(`"${name}"`)));
    return named.length
        ? `Load ${named.join(', ')} first: call tool_search with the tool's name, then call the tool.`
        : REISSUE_HINT;
}
function repeatedCallTurn(context) {
    const guidance = { guidance: context.policy.repeatedCallMessage };
    return { role: 'tool', content: toolResultTurn('tool_call', REPEATED_CALL_ID, guidance) };
}
function cutTailTurn(context, round) {
    const error = { error: CompletionMachine.cutOffMessage(context.policy, round) };
    return { role: 'tool', content: toolResultTurn('tool_call', MALFORMED_CALL_ID, error) };
}
function cutCallId(round) {
    return CompletionMachine.cutShort(round) && !round.toolErrors?.length
        ? round.toolCalls.at(-1)?.id
        : undefined;
}
function resolvedOutput({ context, round, resolved, repeated, deps }) {
    const { session } = deps;
    const cutId = cutCallId(round);
    const cutTail = CompletionMachine.cutShort(round) && Boolean(round.toolErrors?.length);
    const asked = [
        ...context.history,
        {
            role: 'assistant',
            content: assistantToolTurn(round.contentText, resolved.map(({ call, args: callArgs }) => ({ name: call.name, arguments: callArgs })))
        }
    ];
    const loads = loadTurns(session.sdkTools, resolved.map(({ call }) => call.name), asked);
    const history = [
        ...asked,
        ...loads,
        ...(cutTail ? [cutTailTurn(context, round)] : []),
        ...(repeated ? [repeatedCallTurn(context)] : [])
    ];
    return {
        calls: resolved.map(({ call, tool, args: callArgs, rawCall, intent, rejection, permission }) => ({
            id: call.id,
            key: session.callKey(call.name, callArgs),
            name: call.name,
            args: callArgs,
            rawCall,
            intent,
            rejection,
            permission,
            concurrent: tool?.concurrent &&
                !tool.endsRun &&
                !rejection &&
                tool.effect(detachJson(callArgs), toolContext({ deps, context, name: tool.name })) ===
                    'read'
                ? true
                : undefined,
            leavesPlan: context.planMode && tool?.name === Agent.PLAN_TOOL_NAME && callArgs.submit === true
                ? true
                : undefined,
            cutOff: call.id === cutId ? true : undefined
        })),
        history: spliceFrom(context.history, history)
    };
}
