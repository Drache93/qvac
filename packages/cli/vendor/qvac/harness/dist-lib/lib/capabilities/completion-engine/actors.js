import { fromPromise } from 'xstate';
import { didDrainTimeOut, raceDrain } from '../../helpers/drain.js';
import { AbortedError, RecoveryRequired, tagError } from '../../helpers/engine-error.js';
export function createInvokeTracker() {
    let active = 0;
    let idle = Promise.resolve();
    let settleIdle = () => { };
    let stuck = null;
    return {
        trackInvoke() {
            if (active === 0) {
                idle = new Promise((resolve) => {
                    settleIdle = resolve;
                });
            }
            active++;
            let released = false;
            return () => {
                if (released)
                    return;
                released = true;
                active--;
                if (active === 0) {
                    settleIdle();
                }
            };
        },
        waitForInvokes() {
            return idle;
        },
        async drainTimedOut() {
            const waiting = idle;
            if (stuck === waiting) {
                return true;
            }
            if (!didDrainTimeOut(await raceDrain(waiting))) {
                return false;
            }
            stuck = waiting;
            return true;
        }
    };
}
export function createCompletionActors(deps) {
    return {
        preparing: worker('preparing', deps),
        inspectPrepare: worker('inspectPrepare', deps),
        runPrepare: worker('runPrepare', deps),
        searching: worker('searching', deps),
        generating: worker('generating', deps),
        resolving: worker('resolving', deps),
        inspecting: worker('inspecting', deps),
        rejecting: worker('rejecting', deps),
        approving: worker('approving', deps),
        executing: worker('executing', deps),
        batching: worker('batching', deps),
        wrapping: worker('wrapping', deps),
        answering: worker('answering', deps),
        retrieving: worker('retrieving', deps),
        finishing: worker('finishing', deps),
        cleanup: fromPromise(async ({ input }) => {
            try {
                if (await deps.invokes.drainTimedOut()) {
                    throw new AbortedError();
                }
                const release = deps.invokes.trackInvoke();
                try {
                    await lifecycle({ deps, phase: 'runPause', context: contextOf(input.parent) });
                }
                finally {
                    release();
                }
            }
            catch (error) {
                throw tagError(error);
            }
        }),
        resume: fromPromise(async ({ input, signal }) => {
            const release = deps.invokes.trackInvoke();
            const context = contextOf(input.parent);
            try {
                await deps.ports.rebuild(invocation({
                    parent: input.parent,
                    context,
                    stage: 'resume',
                    signal,
                    isLive: () => !signal.aborted,
                    journal: deps.journal,
                    canCommitSettledResult: () => !signal.aborted,
                    settledResultFacts: deps.ports.settledResultFacts
                }));
                for (const receipt of deps.journal.receipts.values()) {
                    if (receipt.status === 'retry' &&
                        (receipt.name === 'hook:runPause' || receipt.name === 'hook:runResume')) {
                        const phase = receipt.name === 'hook:runPause' ? 'runPause' : 'runResume';
                        await lifecycle({ deps, phase, context, signal, operationId: receipt.id });
                    }
                }
                await lifecycle({ deps, phase: 'runResume', context, signal });
            }
            catch (error) {
                throw tagError(error);
            }
            finally {
                release();
            }
        })
    };
}
function worker(stage, deps) {
    return fromPromise(async ({ input, signal }) => {
        const { journal, ports } = deps;
        const context = contextOf(input.parent);
        const release = deps.invokes.trackInvoke();
        let acceptingOutput = true;
        const isLive = () => acceptingOutput && !signal.aborted;
        try {
            await journal.flush();
            if (signal.aborted) {
                throw new AbortedError();
            }
            const emitContent = deps.emitContent
                ? (event) => {
                    if (isLive()) {
                        deps.emitContent?.(event);
                    }
                }
                : undefined;
            const output = await ports.stages[stage](invocation({
                parent: input.parent,
                context,
                stage,
                signal,
                emitContent,
                isLive,
                journal,
                canCommitSettledResult: () => acceptingOutput,
                settledResultFacts: ports.settledResultFacts
            }));
            acceptingOutput = false;
            await journal.flush();
            if (signal.aborted) {
                throw new AbortedError();
            }
            const uncertain = journal.uncertainWrite();
            if (uncertain) {
                throw new RecoveryRequired(uncertain);
            }
            return output;
        }
        catch (error) {
            acceptingOutput = false;
            throw tagError(error);
        }
        finally {
            acceptingOutput = false;
            release();
        }
    });
}
function invocation({ parent, context, stage, signal, emitContent, isLive, journal, canCommitSettledResult, settledResultFacts }) {
    const committedReceipts = new Set();
    return {
        context,
        signal,
        stage,
        emit: (event) => {
            if (!isLive())
                return;
            if ((event.type === 'content' || event.type === 'thinking') && emitContent) {
                emitContent(event);
            }
            else {
                parent.send({ type: 'OUTPUT', event });
            }
        },
        commit: (facts) => {
            if (!isLive() || contextOf(parent).durable === facts) {
                return;
            }
            parent.send({ type: 'FACTS', value: facts });
        },
        commitSettledResult: (operationId) => {
            if (!canCommitSettledResult() || journal.sealed || journal.failure) {
                return;
            }
            if (committedReceipts.has(operationId)) {
                return;
            }
            const receipt = journal.getReceipt(operationId);
            if (receipt?.status !== 'result') {
                return;
            }
            const projected = settledResultFacts?.(operationId, contextOf(parent).durable);
            if (!projected) {
                return;
            }
            committedReceipts.add(operationId);
            parent.send({ type: 'FACTS', value: projected });
        }
    };
}
function contextOf(parent) {
    return parent.getSnapshot().context;
}
async function lifecycle({ deps, phase, context, signal, operationId = `${context.runId}:${phase}-${context.pauseCount}` }) {
    await deps.journal.flush();
    if (signal?.aborted) {
        throw new AbortedError();
    }
    await deps.journal.operation({ id: operationId, name: `hook:${phase}`, args: {}, effect: 'write' }, async () => {
        if (signal?.aborted)
            throw new AbortedError();
        await deps.ports.lifecycle(phase, context);
    });
}
