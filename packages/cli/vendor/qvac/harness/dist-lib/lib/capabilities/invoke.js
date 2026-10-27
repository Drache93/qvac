import { errorMessage } from '../guards.js';
import { AbortedError } from '../helpers/race-abort.js';
import { detachJson } from '../helpers/detach-json.js';
const CAPABILITY_TOOLS = {
    image: { tool: 'generate_image', enhances: 'prompt' },
    translate: { tool: 'translate' }
};
export const CAPABILITIES = Object.keys(CAPABILITY_TOOLS).filter(isCapability);
export function isCapability(name) {
    return name in CAPABILITY_TOOLS;
}
export async function* invoke({ capability, args, tools, ctx, enhance = 'never', enhancer }) {
    const entry = CAPABILITY_TOOLS[capability];
    const tool = tools.find((candidate) => candidate.name === entry.tool);
    if (!tool) {
        yield { type: 'error', message: `${capability} is not available on this device` };
        return;
    }
    const startedAt = Date.now();
    const field = 'enhances' in entry ? entry.enhances : null;
    let routeModel;
    let totalTokens = 0;
    let called = args;
    if (enhance === 'auto' && field && enhancer) {
        const source = called[field];
        if (typeof source === 'string' && source) {
            const enhanced = await enhancer(source, ctx.signal);
            if (enhanced) {
                called = { ...called, [field]: enhanced.text };
                routeModel = enhanced.model;
                totalTokens = enhanced.totalTokens ?? 0;
            }
        }
    }
    if (ctx.signal?.aborted) {
        return yield { type: 'aborted' };
    }
    const effect = tool.effect(detachJson(called), ctx);
    yield { type: 'tool-call', name: entry.tool, args: detachJson(called), effect };
    try {
        const result = await tool.execute(detachJson(called), ctx);
        if (ctx.signal?.aborted) {
            return yield { type: 'aborted' };
        }
        yield { type: 'tool-result', name: entry.tool, result: detachJson(result) };
    }
    catch (err) {
        if (err instanceof AbortedError || ctx.signal?.aborted) {
            yield { type: 'aborted' };
            return;
        }
        yield { type: 'error', message: errorMessage(err) };
        return;
    }
    yield {
        type: 'metrics',
        totalTokens,
        durationMs: Date.now() - startedAt,
        route: routeModel ? 'enhanced' : 'direct',
        routeModel
    };
}
