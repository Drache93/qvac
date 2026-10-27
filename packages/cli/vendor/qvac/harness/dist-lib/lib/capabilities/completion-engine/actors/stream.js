import { reportUnnamedWrites } from '../loop.js';
import { recordWholeRound, runRecoveredRound } from '../round.js';
import { ModelRound } from '../model-round.js';
import { ToolSets } from '../tool-sets.js';
import { AbortedError } from '../../../helpers/race-abort.js';
export async function forwardStream({ stream, emit }) {
    try {
        while (true) {
            const step = await stream.next();
            if (step.done) {
                return step.value;
            }
            emit(step.value);
        }
    }
    finally {
        await Promise.resolve(stream.return(undefined)).catch(noop);
    }
}
export async function runRound({ sdk, modelRound, kind, args, session, emit }) {
    if (args.signal?.aborted)
        throw new AbortedError();
    const live = { round: args.round, kind, startedAt: Date.now(), rawChars: 0, reasoningDeltas: 0 };
    session.liveRound = live;
    try {
        const round = modelRound
            ? await remoteRound({
                port: modelRound,
                kind,
                args: { ...args, live },
                runId: session.runId,
                emit
            })
            : await forwardStream({
                stream: runRecoveredRound(sdk, { ...args, live, knownTools: session.enabled }),
                emit
            });
        session.liveRound = null;
        return round;
    }
    catch (error) {
        if (error instanceof AbortedError || args.signal?.aborted) {
            throw new AbortedError();
        }
        session.liveRound = null;
        throw error;
    }
}
async function remoteRound({ port, kind, args, runId, emit }) {
    const params = await recordWholeRound(args);
    const result = await ModelRound.run(port, {
        runId,
        round: args.round,
        kind,
        attempt: 0,
        modelId: params.modelId,
        history: params.history,
        tools: params.tools,
        toolSet: params.tools && ToolSets.hash(params.tools),
        generationParams: params.generationParams,
        responseFormat: params.responseFormat,
        toolDialect: params.toolDialect,
        cacheKey: args.cacheKey,
        promptPrefix: args.promptPrefix,
        continuationNudge: args.continuationNudge,
        deliveredNudge: args.deliveredNudge,
        unforced: args.unforced
    }, { signal: args.signal, emit });
    return {
        contentText: result.contentText,
        final: result.final,
        history: args.history,
        cacheable: true,
        unproven: result.unproven ?? null,
        replay: result.replay ?? null,
        reasoningDeltas: result.reasoningDeltas,
        ctxSize: result.ctxSize,
        overflows: result.overflows,
        cut: result.cut
    };
}
export async function assembleAnswer({ contentText, replay, landed, emit }) {
    let response = replay || contentText;
    if (replay) {
        emit({ type: 'content', text: replay });
    }
    if (replay || contentText.trim()) {
        await forwardStream({
            stream: reportUnnamedWrites(`${contentText}\n${replay}`, landed),
            emit: (event) => {
                if (event.type === 'content') {
                    response += event.text;
                }
                emit(event);
            }
        });
    }
    return response;
}
const noop = () => { };
