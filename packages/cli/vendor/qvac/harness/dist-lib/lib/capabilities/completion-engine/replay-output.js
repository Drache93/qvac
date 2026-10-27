import { isRecord } from '../../guards.js';
export function readLastRoundText(context) {
    const lastRound = context?.lastRound;
    if (!isRecord(lastRound)) {
        return undefined;
    }
    return {
        contentText: typeof lastRound.contentText === 'string' ? lastRound.contentText : '',
        thinkingText: typeof lastRound.thinkingText === 'string' ? lastRound.thinkingText : undefined
    };
}
function* replayRoundText(runId, round, last) {
    if (last.thinkingText) {
        yield { type: 'thinking', text: last.thinkingText, runId, round };
    }
    if (last.contentText) {
        yield { type: 'content', text: last.contentText, runId, round };
    }
}
export function* replayFinalRound(args) {
    const { runId, round, last, response } = args;
    yield* replayRoundText(runId, round, last);
    if (typeof response !== 'string') {
        return;
    }
    const prefix = last.contentText;
    if (response.length > prefix.length && response.startsWith(prefix)) {
        const remainder = response.slice(prefix.length);
        if (remainder) {
            yield { type: 'content', text: remainder, runId, round };
        }
    }
}
export function* replaySuccessOutput(args) {
    const { runId, round, context, output } = args;
    if (!isRecord(output) || output.status !== 'success' || typeof output.response !== 'string') {
        return;
    }
    const lastRound = readLastRoundText(context);
    if (lastRound && typeof round === 'number') {
        yield* replayFinalRound({ runId, round, last: lastRound, response: output.response });
        return;
    }
    yield {
        type: 'content',
        text: output.response,
        runId,
        round: typeof round === 'number' ? round : undefined
    };
}
