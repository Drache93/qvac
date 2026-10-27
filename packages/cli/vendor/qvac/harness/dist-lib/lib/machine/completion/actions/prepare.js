import { applyPreparation } from './completion.js';
import { activate, applyHistorySplice } from '../rules.js';
export function requestPrepare({ context, params }) {
    const { preparation, step } = params;
    return {
        ...applyPreparation(context, { ...preparation, history: step.history }),
        prepareStep: { id: step.id, tool: step.tool, args: step.args },
        pendingSearch: step.pendingSearch
    };
}
export function authorizePrepare({ context, params }) {
    const step = context.prepareStep;
    return { prepareStep: step && { ...step, args: params.args, facts: params.facts ?? undefined } };
}
export function settlePrepareFailure({ context, params }) {
    const failure = 'failure' in params ? params.failure : null;
    if (!failure) {
        return {};
    }
    return { ...applyHistorySplice(context, failure.history), cacheKey: null, prepareStep: null };
}
export function settlePrepare({ context, params }) {
    return {
        activated: activate(context.activated, params.activate ? [params.activate] : []),
        cacheKey: params.cacheable === false ? null : context.cacheKey,
        ...applyHistorySplice(context, params.history),
        sources: params.source ? [...context.sources, params.source] : context.sources,
        prepareStep: null
    };
}
