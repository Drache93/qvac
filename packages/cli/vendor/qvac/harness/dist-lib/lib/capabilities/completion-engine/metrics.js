export function metricsEvent(state, wallMs, { usage, outcome, cancelled } = {}) {
    if (!state.tokens && !cancelled) {
        return null;
    }
    const rounds = cancelled ? [...state.rounds, cancelled] : state.rounds;
    const event = {
        type: 'metrics',
        totalTokens: state.tokens,
        durationMs: wallMs,
        modelMs: sum(rounds),
        toolMs: sum(state.tools),
        timeToFirstToken: state.ttft,
        promptTokensPerSecond: prefillRate(rounds),
        tokensPerSecond: state.decodeMs > 0 ? (state.timedTokens / state.decodeMs) * 1000 : undefined,
        promptTokens: state.promptTokens,
        cacheTokens: state.cacheTokens,
        rounds,
        tools: state.tools
    };
    if (state.ctxSize) {
        event.ctxSize = state.ctxSize;
    }
    if (state.backends?.length) {
        event.backends = state.backends;
    }
    if (usage) {
        event.usage = usage;
    }
    const stopReason = cancelled ? cancelled.stopReason : state.stopReason;
    if (stopReason) {
        event.stopReason = stopReason;
    }
    if (outcome) {
        event.outcome = outcome;
    }
    return event;
}
export function cancelledRound(live) {
    if (!live) {
        return null;
    }
    const record = {
        round: live.round,
        durationMs: Date.now() - live.startedAt,
        stopReason: 'cancelled',
        rawContentChars: live.rawChars,
        kind: live.kind
    };
    if (live.reasoningDeltas > 0) {
        record.reasoningDeltas = live.reasoningDeltas;
    }
    return record;
}
function sum(records) {
    return records.reduce((total, record) => total + record.durationMs, 0);
}
function prefillRate(rounds) {
    let tokens = 0;
    let seconds = 0;
    for (const { promptTokens, promptTokensPerSecond } of rounds) {
        if (promptTokens && promptTokensPerSecond) {
            tokens += promptTokens;
            seconds += promptTokens / promptTokensPerSecond;
        }
    }
    return seconds > 0 ? tokens / seconds : undefined;
}
