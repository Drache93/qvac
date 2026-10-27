import { compactedFrom, contextCandidates, TOOL_SEARCH_RESULT } from '../../context-window.js';
import { Agent } from '../../agent/index.js';
import { HarnessError } from '../../errors.js';
import { bufferBurst } from '../../helpers/buffer-burst.js';
import { endsTurn, stopAtControlToken } from '../../helpers/control-tokens.js';
import { createMarkupStreamFilter } from '../../helpers/markup-stream-filter.js';
import { AbortedError, raceAbort } from '../../helpers/race-abort.js';
import { raceTimeout } from '../../helpers/race-timeout.js';
import { withoutRepeatedReply } from '../../helpers/repeated-reply.js';
import { recoverMarkupToolCalls } from '../../helpers/tool-call-markup.js';
import { splitThinking, tapThinking } from '../../helpers/thinking.js';
import { errorMessage } from '../../guards.js';
import { HarnessLog } from '../../log.js';
import { isContextOverflowError, isForcedCallFault, isKvCacheSaveFault, isSdkModelWedgedError, isToolGrammarFault } from '../../models/sdk-faults.js';
import { copy } from '../../helpers/copy.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { detachJson } from '../../helpers/detach-json.js';
import { materializeCompletionHistory } from '../tool-turns.js';
import { completionParams } from '../../helpers/completion-params.js';
import { isFailureResultReference } from '../../helpers/failure-result.js';
import { Fold } from '../../fold/index.js';
import { CompletionMachine } from '../../machine/index.js';
import { modelTurns } from './turns.js';
const BURST_WINDOW_MS = 100;
const noop = () => { };
function unprovenReplay(state, final) {
    if (!state.unproven)
        return null;
    if (state.stopToken) {
        return endsTurn(state.stopToken) ? state.unproven : null;
    }
    if (state.runaway ||
        state.cut !== null ||
        final.stopReason === 'length' ||
        final.stopReason === 'cancelled') {
        return null;
    }
    return state.unproven;
}
function cancelOnce(sdk, requestId) {
    let done = false;
    let pending = Promise.resolve();
    const cancel = () => {
        if (done || !requestId)
            return;
        done = true;
        pending = sdk.cancel?.({ requestId }).catch(noop) ?? Promise.resolve();
    };
    return Object.assign(cancel, { flush: () => pending });
}
async function* contentDeltas(events) {
    for await (const event of events) {
        if (event.type === 'contentDelta') {
            yield event.text;
        }
    }
}
async function* countGenerated(tokens, state) {
    for await (const token of tokens) {
        state.live.rawChars += token.length;
        yield token;
    }
}
async function* runRoundTokens({ result, state, cancelThisRound, unsettled, signal, startInThink, knownTools }) {
    signal?.addEventListener('abort', cancelThisRound, { once: true });
    armCut(state, cancelThisRound);
    const closeCalls = watchToolCalls(result.toolCallStream, state, cancelThisRound);
    const tokens = stopAtControlToken(contentDeltas(result.events), (token) => {
        state.stopToken = token;
    });
    const counted = tapThinking(tokens, { startInThink }, () => {
        state.live.reasoningDeltas = ++state.reasoningDeltas;
    });
    let tokenEvents = 0;
    const events = splitThinking(bufferBurst(countGenerated(counted, state), BURST_WINDOW_MS), {
        startInThink
    });
    const thinkingFilter = createMarkupStreamFilter();
    const contentFilter = createMarkupStreamFilter({
        onToolCall: watchMarkupCalls(state, knownTools, cancelThisRound)
    });
    try {
        tokenEvents = yield* processRoundTokenEvents({
            events,
            state,
            cancelThisRound,
            signal,
            thinkingFilter,
            contentFilter
        });
        HarnessLog.info('stream ended', { events: tokenEvents, stopToken: state.stopToken });
        if (state.stopToken) {
            cancelThisRound();
        }
    }
    finally {
        if (signal?.aborted) {
            cancelThisRound();
        }
        signal?.removeEventListener('abort', cancelThisRound);
        state.live.cut = undefined;
        closeCalls();
        const closed = events.return(null);
        if (signal?.aborted) {
            unsettled.push(closed.catch(noop));
        }
        else {
            await closed;
        }
    }
}
function armCut(state, cancelThisRound) {
    if (state.live.kind !== 'streaming')
        return;
    state.live.cut = (note) => {
        if (state.cut !== null)
            return;
        state.cut = note;
        HarnessLog.info('round cut by the host', { round: state.live.round });
        cancelThisRound();
    };
}
function tripsCap(state, seen, call) {
    state.calls.push(call);
    return tripsCount(seen, stableStringify([call.name, call.arguments]), state.calls.length);
}
function tripsCount(seen, key, total) {
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count >= CompletionMachine.MAX_ROUND_REPEATS || total >= CompletionMachine.MAX_ROUND_CALLS;
}
function watchMarkupCalls(state, knownTools, cancelThisRound) {
    const seen = new Map();
    let blocks = 0;
    return (body) => {
        if (state.runaway)
            return;
        blocks++;
        const parsed = recoverMarkupToolCalls(body, knownTools).map((call) => [
            call.name,
            call.arguments
        ]);
        const key = parsed.length ? stableStringify(parsed) : body.trim();
        if (tripsCount(seen, key, blocks)) {
            state.runaway = true;
            HarnessLog.info('round stopped on its tool markup', { blocks });
            cancelThisRound();
        }
    };
}
function watchToolCalls(stream, state, cancelThisRound) {
    if (!stream)
        return noop;
    const calls = stream[Symbol.asyncIterator]();
    const seen = new Map();
    let closed = false;
    const close = () => {
        if (closed)
            return;
        closed = true;
        Promise.resolve(calls.return?.()).catch(noop);
    };
    const drain = async () => {
        let next = await calls.next();
        while (!next.done && !closed) {
            if (tripsCap(state, seen, next.value.call)) {
                state.runaway = true;
                HarnessLog.info('round stopped on its tool calls', { calls: state.calls.length });
                cancelThisRound();
                close();
                return;
            }
            next = await calls.next();
        }
    };
    drain().catch(noop);
    return close;
}
async function* processRoundTokenEvents({ events, state, cancelThisRound, signal, thinkingFilter, contentFilter }) {
    let tokenEvents = 0;
    while (true) {
        if (signal?.aborted) {
            cancelThisRound();
            throw new AbortedError();
        }
        const next = await raceAbort(events.next(), signal);
        if (next.done) {
            state.unproven = next.value;
            yield* flushFilterTails(thinkingFilter, contentFilter);
            break;
        }
        tokenEvents++;
        if (next.value.type === 'content') {
            state.rawContentText += next.value.text;
        }
        const filter = next.value.type === 'thinking' ? thinkingFilter : contentFilter;
        const text = filter.push(next.value.text);
        if (text) {
            yield { type: next.value.type, text };
        }
    }
    return tokenEvents;
}
async function* flushFilterTails(thinkingFilter, contentFilter) {
    const thinkingTail = thinkingFilter.flush();
    if (thinkingTail) {
        yield { type: 'thinking', text: thinkingTail };
    }
    const contentTail = contentFilter.flush();
    if (contentTail) {
        yield { type: 'content', text: contentTail };
    }
}
export function foldTokens(stats, cacheable) {
    if (cacheable !== false)
        return stats?.cacheTokens;
    if (stats?.promptTokens === undefined)
        return undefined;
    return stats.promptTokens + (stats.generatedTokens ?? 0);
}
function slotStats(stats, previous) {
    if (!stats)
        return undefined;
    const { cacheTokens: _summed, ...rest } = stats;
    if (previous === undefined || stats.promptTokens === undefined) {
        return rest;
    }
    return { ...rest, cacheTokens: previous + stats.promptTokens + (stats.generatedTokens ?? 0) };
}
function boundaryStats(final, predict) {
    const stats = copy(final.stats);
    if (final.stopReason !== 'length' || stats?.contextBoundary !== undefined) {
        return stats;
    }
    const capped = predict !== undefined && predict > 0 && (stats?.generatedTokens ?? 0) >= predict;
    return { ...stats, contextBoundary: !capped };
}
function roundTokens(stats) {
    if (!stats)
        return undefined;
    const tokens = {
        prompt: stats.promptTokens,
        generated: stats.generatedTokens,
        cached: stats.cacheTokens,
        timeToFirstToken: stats.timeToFirstToken
    };
    return Object.values(tokens).some((value) => value !== undefined) ? tokens : undefined;
}
const TRUNCATED_FINAL_MS = 2000;
function truncatedFinal(final, contentText) {
    const accepted = { contentText, toolCalls: [], raw: { fullText: contentText } };
    const guarded = final.catch((err) => {
        if (isSdkModelWedgedError(err))
            throw err;
        return accepted;
    });
    guarded.catch(noop);
    return raceTimeout(guarded, { ms: TRUNCATED_FINAL_MS, fallback: accepted });
}
export async function* runRecoveredRound(sdk, args) {
    const lease = args.acquireRound ? await args.acquireRound(args.signal) : null;
    const unsettled = [];
    try {
        const roundSdk = lease?.sdk ?? sdk;
        if (!roundSdk) {
            throw new Error('A completion round requires an SDK');
        }
        const ctxSize = lease?.ctxSize ?? args.fold?.ctxSize;
        const slotted = (lease?.slots ?? 1) > 1;
        const attempts = { sent: 0, uncached: false, overflows: 0, unsettled };
        const round = yield* runRecoveredRoundWith({
            sdk: roundSdk,
            args,
            modelId: lease?.modelId ?? args.modelId,
            ctxSize,
            attempts
        });
        const final = slotted
            ? {
                ...round.final,
                stats: slotStats(round.final.stats, round.cacheable !== false && args.cacheKey
                    ? (Fold.reading(args.cacheKey)?.cacheTokens ?? 0)
                    : undefined)
            }
            : round.final;
        if (args.fold?.cacheKey) {
            Fold.observe(args.fold.cacheKey, {
                cacheTokens: foldTokens(final.stats, round.cacheable),
                ctxSize
            });
        }
        const overflows = attempts.overflows ? { overflows: attempts.overflows } : {};
        return { ...round, final, ctxSize: lease?.ctxSize, ...overflows };
    }
    finally {
        if (lease && unsettled.length) {
            void Promise.all(unsettled).then(() => releaseLease(lease));
        }
        else if (lease) {
            releaseLease(lease);
        }
    }
}
function releaseLease(lease) {
    try {
        lease.release();
    }
    catch (error) {
        HarnessLog.info('completion round lease release failed', { error: errorMessage(error) });
    }
}
export async function recordWholeRound(args) {
    const history = materializeCompletionHistory(args.history, args.failureResults);
    const origins = historyOrigins(args.history, history);
    const params = inferenceParams({ args, modelId: args.modelId, history, cacheable: true });
    await args.recordRequest?.({ round: args.round, attempt: 0, droppedTurns: 0, params }, failureTurns(args, origins, history));
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    return params;
}
async function* runRecoveredRoundWith(send) {
    const { args } = send;
    let history = materializeCompletionHistory(args.history, args.failureResults);
    const origins = historyOrigins(args.history, history);
    const reading = args.fold?.reading ??
        (args.round === 0 && args.fold?.cacheKey ? Fold.reading(args.fold.cacheKey) : undefined);
    const fold = { chat: false, rounds: false };
    if (reading && Fold.due({ ...reading, ctxSize: reading.ctxSize ?? send.ctxSize })) {
        history = (yield* foldHistory(send, history, fold)) ?? history;
    }
    while (true) {
        const outcome = yield* runLadder({ send, history, origins, fold });
        if ('round' in outcome) {
            return outcome.round;
        }
        if (!('folded' in outcome)) {
            throw new HarnessError('CONTEXT_WINDOW_EXCEEDED', [], { cause: outcome.overflow });
        }
        history = outcome.folded;
    }
}
async function* runLadder({ send, history, origins, fold }) {
    let lastOverflow = null;
    for (const candidate of contextCandidates(history, send.args.continuationNudge, send.args.deliveredNudge)) {
        const outcome = yield* runCandidateAttempts({ ...send, candidate, history, origins });
        if ('round' in outcome) {
            return { round: recoveredRound({ candidate, attempt: outcome.round, origins }) };
        }
        lastOverflow = outcome.overflow;
        send.attempts.overflows++;
        if (candidate.history === history) {
            const folded = yield* foldHistory(send, history, fold);
            if (folded) {
                return { folded };
            }
        }
    }
    if (!lastOverflow) {
        throw new Error('context recovery produced no completion candidate');
    }
    return { overflow: lastOverflow };
}
async function* foldHistory(send, history, tries) {
    if (!tries.chat) {
        tries.chat = true;
        const folded = yield* foldChat(send, history);
        if (folded) {
            return folded;
        }
    }
    if (tries.rounds) {
        return null;
    }
    tries.rounds = true;
    return foldRounds(send, history);
}
async function foldRounds(send, history) {
    const { sdk, args, ctxSize } = send;
    const spec = args.fold;
    const nudges = [args.continuationNudge, args.deliveredNudge];
    if (!spec || !Fold.roundBoundary(history, { nudges, keeps: keepsLoad })?.foldedRounds) {
        return null;
    }
    const instructions = await spec.instructions?.(history);
    const result = await new Fold(summarizer(send)).rounds(history, {
        ctxSize,
        instructions,
        nudges,
        keeps: keepsLoad
    });
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    if (!result.folded) {
        HarnessLog.info('rounds fold refused', { round: args.round, reason: result.reason });
        return null;
    }
    if (args.cacheKey) {
        await dropFoldedKey(sdk, args.cacheKey);
    }
    HarnessLog.info('folded rounds', { round: args.round, foldedRounds: result.foldedRounds });
    return result.history;
}
function keepsLoad(message) {
    return (message.role === 'tool' &&
        (message.content.startsWith(TOOL_SEARCH_RESULT) ||
            message.content.startsWith(`[Tool: ${Agent.SKILL_TOOL_NAME} (`)));
}
async function* foldChat(send, history) {
    const { sdk, args, ctxSize } = send;
    const spec = args.fold;
    const widest = spec && Fold.boundary(spec.messages);
    const at = spec && widest ? renderedAt(history, spec, widest.end) : null;
    if (!spec || at === null) {
        return null;
    }
    const instructions = await spec.instructions?.(spec.messages);
    const run = new Fold(summarizer(send)).run(spec.messages, { ctxSize, instructions });
    let step = await run.next();
    while (!step.done) {
        yield step.value;
        step = await run.next();
    }
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const result = step.value;
    if (!result.folded) {
        HarnessLog.info('fold refused', { round: args.round, reason: result.reason });
        return null;
    }
    const replaced = modelTurns(spec.messages.slice(0, result.end), spec.nudge).length;
    const folded = [
        ...history.slice(0, at),
        { role: 'user', content: Fold.turn(result.summary) },
        ...history.slice(at + replaced)
    ];
    if (args.cacheKey) {
        await dropFoldedKey(sdk, args.cacheKey);
    }
    HarnessLog.info('folded', { round: args.round, foldedTurns: result.foldedTurns });
    yield {
        type: 'fold',
        phase: 'done',
        summary: result.summary,
        throughId: result.throughId,
        foldedTurns: result.foldedTurns
    };
    return folded;
}
async function dropFoldedKey(sdk, cacheKey) {
    Fold.forget(cacheKey);
    try {
        const deleted = await sdk.deleteCache?.({ kvCacheKey: cacheKey });
        if (deleted && !deleted.success) {
            HarnessLog.info('fold key delete did not succeed');
        }
    }
    catch (error) {
        HarnessLog.info('fold key delete failed', { error: errorMessage(error) });
    }
}
function renderedAt(history, spec, end) {
    const rendered = modelTurns(spec.messages.slice(0, end), spec.nudge);
    const matches = (at) => rendered.every((turn, index) => history[at + index]?.role === turn.role && history[at + index]?.content === turn.content);
    return [0, 1].find(matches) ?? null;
}
function summarizer(send) {
    return async (prompt) => {
        try {
            return await summarizeOnce(send, prompt);
        }
        catch (error) {
            if (!isKvCacheSaveFault(error)) {
                return refusedSummary(error);
            }
            HarnessLog.info('kv cache save failed, retrying the fold summary', {
                round: send.args.round,
                error: errorMessage(error)
            });
            return summarizeOnce(send, prompt).catch(refusedSummary);
        }
    };
}
async function summarizeOnce(send, prompt) {
    const { sdk, args, modelId, attempts } = send;
    const params = completionParams({
        modelId,
        history: [{ role: 'user', content: prompt }],
        generationParams: { reasoning_budget: 0 }
    });
    await args.recordRequest?.({ round: args.round, attempt: attempts.sent++, droppedTurns: 0, params }, []);
    if (args.signal?.aborted) {
        return { text: null, overflowed: false };
    }
    const result = withoutRepeatedReply(sdk.completion(params));
    result.final.catch(noop);
    const cancel = cancelOnce(sdk, result.requestId);
    args.signal?.addEventListener('abort', cancel, { once: true });
    let text = '';
    try {
        for await (const event of splitThinking(stopAtControlToken(contentDeltas(result.events), cancel))) {
            if (event.type === 'content') {
                text += event.text;
            }
        }
        await raceAbort(result.final, args.signal);
        return { text: args.signal?.aborted ? null : text, overflowed: false };
    }
    catch (error) {
        cancel();
        throw error;
    }
    finally {
        args.signal?.removeEventListener('abort', cancel);
        await raceTimeout(cancel.flush(), { ms: TRUNCATED_FINAL_MS, fallback: undefined });
    }
}
function refusedSummary(error) {
    return { text: null, overflowed: isContextOverflowError(error) };
}
async function* runCandidateAttempts(input) {
    const { sdk, args, modelId, candidate, history, origins, attempts } = input;
    let attemptArgs = attempts.uncached ? { ...args, cacheKey: undefined } : args;
    while (true) {
        if (args.signal?.aborted)
            throw new AbortedError();
        const progress = {
            cancel: cancelOnce(sdk, undefined),
            emitted: false,
            attempt: attempts.sent++,
            unsettled: attempts.unsettled
        };
        try {
            const round = yield* runCandidate({
                sdk,
                args: attemptArgs,
                modelId,
                candidate,
                progress,
                baseHistory: history,
                origins
            });
            return { round: attempts.uncached ? { ...round, cacheable: false } : round };
        }
        catch (err) {
            if (err instanceof AbortedError || args.signal?.aborted) {
                progress.cancel();
            }
            if (args.capture) {
                yield candidateFailureEvent({ args, candidate, error: err });
            }
            const grammarOff = withoutToolGrammar(attemptArgs, err);
            if (grammarOff) {
                HarnessLog.info('tool grammar fault, retrying the round without it', { round: args.round });
                yield* resetShownRound(args, progress);
                attemptArgs = grammarOff;
                continue;
            }
            const unforced = withoutForcedCall(attemptArgs, err);
            if (unforced) {
                HarnessLog.info('forced tool call refused, retrying the round without it', {
                    round: args.round
                });
                yield* resetShownRound(args, progress);
                attemptArgs = unforced;
                continue;
            }
            if (!attempts.uncached && isKvCacheSaveFault(err)) {
                HarnessLog.info('kv cache save failed, retrying the round uncached', {
                    round: args.round,
                    error: errorMessage(err)
                });
                yield* resetShownRound(args, progress);
                attempts.uncached = true;
                attemptArgs = { ...attemptArgs, cacheKey: undefined };
                continue;
            }
            if (!isContextOverflowError(err)) {
                throw err;
            }
            if (progress.emitted) {
                yield* foldChat(input, history);
                throw new HarnessError('CONTEXT_WINDOW_EXCEEDED', [], { cause: err });
            }
            return { overflow: err };
        }
        finally {
            await flushCandidate(args, progress);
        }
    }
}
function* resetShownRound(args, progress) {
    if (progress.emitted && args.runId) {
        yield {
            type: 'round-reset',
            runId: args.runId,
            round: args.round,
            replacedTypes: ['content', 'thinking']
        };
    }
}
function withoutToolGrammar(args, err) {
    if (!isToolGrammarFault(err) ||
        !args.tools?.length ||
        args.generationParams?.tool_choice === 'none') {
        return null;
    }
    return {
        ...args,
        generationParams: { reasoning_budget: 0, ...args.generationParams, tool_choice: 'none' }
    };
}
function withoutForcedCall(args, err) {
    if (!args.unforced || !isForcedCallFault(err)) {
        return null;
    }
    return { ...args, generationParams: args.unforced.generationParams, unforced: undefined };
}
async function flushCandidate(args, progress) {
    if (args.signal?.aborted) {
        progress.cancel();
    }
    await raceTimeout(progress.cancel.flush(), { ms: TRUNCATED_FINAL_MS, fallback: undefined });
}
function recoveredRound({ candidate, attempt, origins }) {
    const replay = unprovenReplay(attempt.state, attempt.final);
    logCandidateFinal(attempt, replay);
    return {
        contentText: attempt.contentText,
        final: attempt.final,
        history: restoreHistory(candidate.history, origins),
        cacheable: attempt.cacheable,
        unproven: attempt.state.unproven,
        replay,
        reasoningDeltas: attempt.state.reasoningDeltas || undefined,
        cut: attempt.state.cut ?? undefined
    };
}
function historyOrigins(entries, messages) {
    const origins = new WeakMap();
    entries.forEach((entry, index) => {
        if (!isFailureResultReference(entry))
            return;
        const message = messages[index];
        if (!message) {
            throw new Error('Materialized history lost an entry');
        }
        origins.set(message, { entry, fingerprint: stableStringify(message) });
    });
    return origins;
}
async function* runCandidate({ sdk, args, modelId, candidate, progress, baseHistory, origins }) {
    const cacheable = candidate.history === baseHistory;
    const params = inferenceParams({ args, modelId, history: candidate.history, cacheable });
    if (args.capture) {
        yield inferenceCall({
            args,
            candidate,
            modelId,
            params,
            cacheKey: cacheable ? args.cacheKey : undefined
        });
    }
    await args.recordRequest?.({
        round: args.round,
        attempt: progress.attempt,
        droppedTurns: candidate.droppedTurns,
        params
    }, failureTurns(args, origins, candidate.history));
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const result = withoutRepeatedReply(sdk.completion(params));
    result.final.catch(noop);
    progress.cancel = cancelOnce(sdk, result.requestId);
    args.live.rawChars = 0;
    args.live.reasoningDeltas = 0;
    const state = {
        live: args.live,
        stopToken: null,
        calls: [],
        runaway: false,
        cut: null,
        unproven: null,
        rawContentText: '',
        reasoningDeltas: 0
    };
    const contentText = yield* streamCandidateTokens({ result, state, args, progress });
    const final = state.stopToken || state.runaway || state.cut !== null
        ? await truncatedFinal(result.final, state.rawContentText)
        : await raceAbort(result.final, args.signal);
    const detachedFinal = {
        ...final,
        toolCalls: copy(state.runaway || state.cut !== null ? state.calls : (final.toolCalls ?? [])),
        toolErrors: copy(final.toolErrors ?? []),
        stats: boundaryStats(final, params.generationParams?.predict)
    };
    if (args.capture) {
        yield inferenceSent({ args, candidate, final: detachedFinal });
    }
    return { contentText, final: detachedFinal, state, cacheable };
}
function inferenceParams({ args, modelId, history, cacheable }) {
    return completionParams({
        modelId,
        history: detachJson(history),
        tools: args.tools ? detachJson(args.tools) : undefined,
        generationParams: generationParams(args),
        responseFormat: args.responseFormat ? detachJson(args.responseFormat) : undefined,
        toolDialect: args.toolDialect,
        kvCache: cacheable ? args.cacheKey : undefined
    });
}
function generationParams(args) {
    const { reasoning_rounds: _rounds, ...host } = args.generationParams
        ? detachJson(args.generationParams)
        : {};
    const sent = args.generationParams ? host : undefined;
    return args.tools?.length ? { parallel_tool_calls: true, ...sent } : sent;
}
function inferenceCall({ args, candidate, modelId, params, cacheKey }) {
    return {
        type: 'inference-call',
        call: {
            round: args.round,
            droppedTurns: candidate.droppedTurns,
            modelId,
            messages: params.history,
            tools: params.tools,
            generationParams: params.generationParams,
            responseFormat: params.responseFormat,
            toolDialect: params.toolDialect,
            cacheKey,
            promptPrefix: args.promptPrefix
        }
    };
}
function inferenceSent({ args, candidate, final }) {
    return {
        type: 'inference-sent',
        round: args.round,
        droppedTurns: candidate.droppedTurns,
        tokens: roundTokens(final.stats),
        outcome: 'completed',
        reason: undefined
    };
}
async function* streamCandidateTokens({ result, state, args, progress }) {
    let contentText = '';
    const startInThink = (args.generationParams?.reasoning_budget ?? 0) !== 0;
    for await (const event of runRoundTokens({
        result,
        state,
        cancelThisRound: progress.cancel,
        unsettled: progress.unsettled,
        signal: args.signal,
        startInThink,
        knownTools: args.knownTools ?? []
    })) {
        if (event.type === 'content') {
            contentText += event.text;
        }
        progress.emitted = true;
        yield event;
    }
    return contentText;
}
function candidateFailureEvent({ args, candidate, error }) {
    return {
        type: 'inference-sent',
        round: args.round,
        droppedTurns: candidate.droppedTurns,
        tokens: undefined,
        outcome: isContextOverflowError(error) ? 'overflowed' : 'failed',
        reason: errorMessage(error)
    };
}
function logCandidateFinal({ state, final, contentText }, replay) {
    HarnessLog.debug('final', {
        stopReason: final.stopReason,
        toolCalls: final.toolCalls.length,
        toolErrors: final.toolErrors?.length ?? 0,
        contentChars: contentText.length,
        stopToken: state.stopToken,
        runaway: state.runaway,
        cut: state.cut !== null,
        replay: replay !== null
    });
}
function failureTurns(args, origins, sent) {
    return sent.flatMap((message, at) => {
        const source = compactedFrom(message);
        const entry = origins.get(source ?? message)?.entry;
        if (!entry || !isFailureResultReference(entry)) {
            return [];
        }
        const value = args.failureResults[entry.ref];
        const compactedTo = source || entry.compactedTo !== undefined ? message.content.length : undefined;
        return value ? [{ ...value, at, callId: entry.callId, compactedTo }] : [];
    });
}
function restoreHistory(messages, origins) {
    return messages.map((message) => {
        const source = compactedFrom(message);
        const origin = origins.get(source ?? message);
        if (!origin || stableStringify(source ?? message) !== origin.fingerprint) {
            return message;
        }
        return source ? { ...origin.entry, compactedTo: message.content.length } : origin.entry;
    });
}
