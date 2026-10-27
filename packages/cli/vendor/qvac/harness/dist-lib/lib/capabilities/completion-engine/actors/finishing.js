import { AbortedError } from '../../../helpers/race-abort.js';
import { rehydrateError } from '../../../helpers/engine-error.js';
export const finishing = async ({ input: deps, context, signal }) => {
    if (signal.aborted)
        throw new AbortedError();
    if (!deps.session.runStarted)
        return;
    const { failure } = context;
    const payload = {
        runId: context.runId,
        agentId: context.agentId,
        stats: {
            totalTokens: context.metrics.tokens,
            durationMs: Date.now() - deps.session.wallStart,
            timeToFirstToken: context.metrics.ttft
        },
        outcome: context.outcome === 'failed' ? 'error' : 'done',
        error: failure ? rehydrateError(failure, failure.message) : undefined
    };
    if (!deps.session.pipeline.hasPhase('runEnd')) {
        await deps.session.pipeline.onRunEnd(payload);
        return;
    }
    await deps.operations.operation({
        id: `${context.runId}:hook-runEnd`,
        name: 'hook:runEnd',
        args: { outcome: context.outcome },
        effect: 'write'
    }, async () => {
        await deps.session.pipeline.onRunEnd(payload);
    });
};
