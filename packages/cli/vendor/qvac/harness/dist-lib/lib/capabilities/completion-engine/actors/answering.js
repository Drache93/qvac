import { assembleAnswer } from './stream.js';
import { stripToolCallMarkup } from '../../../helpers/tool-call-markup.js';
export const answering = async function answering({ emit, input: { session }, context }) {
    const round = context.lastRound;
    let response;
    if (context.answer !== null) {
        emit({ type: 'content', text: context.answer });
        response = context.answer;
    }
    else if (round.response && !round.contentText.trim() && !round.replay) {
        emit({ type: 'content', text: round.response });
        response = round.response;
    }
    else {
        const replay = round.replay ? stripToolCallMarkup(round.replay) : '';
        response = await assembleAnswer({
            contentText: round.contentText,
            replay,
            landed: session.landed,
            emit
        });
    }
    if (context.outcome !== null) {
        return { response };
    }
    const reason = await session.pipeline.stop({
        runId: session.runId,
        agentId: context.agentId,
        round: context.round,
        response
    });
    return reason === undefined ? { response } : { response, continue: reason };
};
