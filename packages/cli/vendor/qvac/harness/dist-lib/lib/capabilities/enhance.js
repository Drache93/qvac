import { cleanAnswer } from '../helpers/clean-answer.js';
import { raceAbort } from '../helpers/race-abort.js';
import { withoutRepeatedReply } from '../helpers/repeated-reply.js';
import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
import { isKvCacheSaveFault } from '../models/sdk-faults.js';
const SYSTEM = "Rewrite the user's description as a single vivid prompt for an image generator. " +
    'Answer with the prompt alone: no preamble, no quotes, no explanation.';
const MAX_PROMPT_CHARS = 400;
export async function expandImagePrompt(sdk, prompt, options) {
    const final = await rewrite(sdk, prompt, options).catch((err) => {
        if (!isKvCacheSaveFault(err))
            throw err;
        HarnessLog.info('kv cache save failed, retrying the prompt rewrite', {
            error: errorMessage(err)
        });
        return rewrite(sdk, prompt, options);
    });
    const text = cleanAnswer(final.contentText).slice(0, MAX_PROMPT_CHARS);
    if (!text) {
        return null;
    }
    return { text, model: options.model, totalTokens: final.stats?.generatedTokens };
}
async function rewrite(sdk, prompt, { modelId, signal }) {
    const run = withoutRepeatedReply(sdk.completion({
        modelId,
        history: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt }
        ],
        stream: true,
        generationParams: { temp: 0.7, reasoning_budget: 0 }
    }));
    try {
        return await raceAbort(run.final, signal);
    }
    catch (err) {
        if (run.requestId) {
            void sdk.cancel?.({ requestId: run.requestId }).catch(noop);
        }
        throw err;
    }
}
function noop() { }
