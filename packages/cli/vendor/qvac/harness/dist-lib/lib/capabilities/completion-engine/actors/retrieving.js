import { AbortedError } from '../../../helpers/race-abort.js';
import { isFailureResultReference } from '../../../helpers/failure-result.js';
import { HarnessLog } from '../../../log.js';
import { errorMessage } from '../../../guards.js';
import { spliceFrom } from '../splice.js';
import { turnText } from '../turns.js';
export const retrieving = async function retrieving({ input, context, emit }) {
    const { history, edgeInputs } = context;
    const at = history.findLastIndex((entry) => !isFailureResultReference(entry) && entry.role === 'user');
    const turn = history[at];
    const hits = turn && !isFailureResultReference(turn)
        ? await knowledgeSearch(input, {
            id: `${context.runId}:round-${context.round}:input:knowledge`,
            text: turn.content
        })
        : [];
    const excerpts = hits.map((hit) => hit.text);
    for (const [index, queued] of edgeInputs.entries()) {
        const added = index === edgeInputs.length - 1 && excerpts.length ? { excerpts } : {};
        const turnContext = { ...queued.context, ...added };
        if (Object.keys(turnContext).length > 0) {
            emit(queued.id === undefined
                ? { type: 'context', context: turnContext, round: context.round }
                : { type: 'context', id: queued.id, context: turnContext, round: context.round });
        }
    }
    if (!turn || isFailureResultReference(turn) || hits.length === 0) {
        return {};
    }
    const next = [...history];
    next[at] = { ...turn, content: turnText(turn.content, { excerpts }) };
    return {
        history: spliceFrom(history, next),
        sources: hits.map((hit) => input.session.outbound.facts('tool-result', hit.text))
    };
};
export function knowledgeSearch({ args, services, operations }, { id, text }) {
    const knowledge = services?.knowledge;
    const scopes = args.knowledge?.scopes ?? [];
    const query = text.trim();
    if (!knowledge ||
        scopes.length === 0 ||
        !query ||
        args.agent?.disabledToolsets?.includes('knowledge')) {
        return Promise.resolve([]);
    }
    const search = async () => {
        try {
            return await knowledge.search({ text: query, scopes, signal: args.signal });
        }
        catch (error) {
            if (args.signal?.aborted || error instanceof AbortedError) {
                throw error;
            }
            HarnessLog.info('knowledge search failed', { err: errorMessage(error) });
            return [];
        }
    };
    return operations.operation({
        id,
        name: 'knowledge:search',
        args: { scopes: [...scopes].sort() },
        effect: 'read'
    }, search, undefined, args.signal);
}
