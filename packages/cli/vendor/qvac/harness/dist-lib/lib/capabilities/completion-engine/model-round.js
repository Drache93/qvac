import { AbortController } from 'bare-abort-controller';
import { raceAbort } from '../../helpers/race-abort.js';
import { runRecoveredRound } from './round.js';
export class ModelRound {
    port;
    constructor(port) {
        this.port = port;
    }
    run(request, options) {
        return ModelRound.run(this.port, request, options);
    }
    static async run(port, request, { signal = new AbortController().signal, emit }) {
        let taker = 0;
        let open = true;
        const live = () => open && !signal.aborted;
        const emitter = (generation) => (event) => {
            if (generation === taker && live()) {
                emit(event);
            }
        };
        const sent = port(request, {
            signal,
            emit: emitter(0),
            retake: () => {
                if (!live())
                    return noop;
                taker++;
                emit({
                    type: 'round-reset',
                    runId: request.runId,
                    round: request.round,
                    replacedTypes: ['content', 'thinking']
                });
                return emitter(taker);
            }
        });
        sent.catch(noop);
        try {
            return await raceAbort(sent, signal);
        }
        finally {
            open = false;
        }
    }
    static async serve(request, io, { sdk, acquireRound }) {
        const rounds = runRecoveredRound(sdk, servedArgs(request, io.signal, acquireRound));
        let emit = io.emit;
        for await (const event of served(rounds)) {
            if (event.type === 'served') {
                return result(event.round);
            }
            if (event.type === 'content' || event.type === 'thinking') {
                emit(event);
            }
            else if (event.type === 'round-reset') {
                emit = io.retake();
            }
        }
        throw new Error('A served round ended without its result');
    }
}
function servedArgs(request, signal, acquireRound) {
    return {
        modelId: request.modelId,
        acquireRound,
        history: request.history,
        failureResults: {},
        continuationNudge: request.continuationNudge,
        deliveredNudge: request.deliveredNudge,
        tools: request.tools,
        generationParams: request.generationParams,
        responseFormat: request.responseFormat,
        toolDialect: request.toolDialect,
        cacheKey: request.cacheKey,
        signal,
        round: request.round,
        runId: request.runId,
        promptPrefix: request.promptPrefix,
        capture: false,
        knownTools: request.tools,
        unforced: request.unforced,
        live: {
            round: request.round,
            kind: request.kind,
            startedAt: Date.now(),
            rawChars: 0,
            reasoningDeltas: 0
        }
    };
}
async function* served(rounds) {
    yield { type: 'served', round: yield* rounds };
}
function result({ contentText, final, cut, unproven, replay, reasoningDeltas, ctxSize, overflows }) {
    return { contentText, final, cut, unproven, replay, reasoningDeltas, ctxSize, overflows };
}
const noop = () => { };
