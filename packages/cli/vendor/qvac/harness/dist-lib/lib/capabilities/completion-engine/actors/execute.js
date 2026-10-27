import { AbortedError } from '../../../helpers/race-abort.js';
import { executeCall } from '../tool-execution.js';
import { errorMessage } from '../../../guards.js';
import { HookHalt, RecoveryRequired } from '../../../helpers/engine-error.js';
import { ToolPolicyChanged } from '../operations.js';
export async function runToolCall(plan, options) {
    let activity = null;
    try {
        const executed = await executeCall(plan.resolved.tool, plan.resolved.call.arguments, plan.context, {
            runId: options.runId,
            deniedMessage: options.deniedMessage,
            approve: options.approve,
            signal: options.signal,
            denied: options.denied,
            preflight: options.preflight,
            sources: options.sources.sources,
            sourceFacts: options.sources.sourceFacts,
            outbound: options.outbound,
            pipeline: options.pipeline,
            effect: plan.effect,
            callId: options.callId,
            skipApprovals: options.skipApprovals,
            intent: options.intent,
            display: options.display,
            onToolActivity: (value) => {
                activity = value;
                options.onDisplay?.(value);
            }
        });
        return {
            output: executed.result,
            outcome: executed.outcome,
            executed: executed.executed,
            activity
        };
    }
    catch (error) {
        if (error instanceof RecoveryRequired ||
            error instanceof ToolPolicyChanged ||
            error instanceof HookHalt) {
            throw error;
        }
        if (error instanceof AbortedError || options.signal?.aborted) {
            throw new AbortedError();
        }
        const message = errorMessage(error);
        return {
            output: { error: message },
            outcome: { kind: 'error', message, error },
            executed: false,
            activity
        };
    }
}
