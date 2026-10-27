import { AbortedError } from '../../../helpers/race-abort.js';
import { executeCall, readyPreflightFromFacts } from '../tool-execution.js';
import { errorMessage } from '../../../guards.js';
import { toolContext } from './execution-plan.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { RecoveryRequired } from '../../../helpers/engine-error.js';
import { ToolPolicyChanged } from '../operations.js';
export function runPrepare(source) {
    return async function runPrepare({ emit, input: deps, context }) {
        const { args, session } = deps;
        const step = context.prepareStep;
        if (!step) {
            throw new Error('prepare execution requires an authorized step');
        }
        const tool = session.enabled.find((tool) => tool.name === step.tool);
        if (!tool) {
            throw new Error(`prepare step requires the ${step.tool} tool`);
        }
        const facts = step.facts;
        if (!facts) {
            throw new Error('prepare step has no authorized facts');
        }
        if (args.signal?.aborted) {
            throw new AbortedError();
        }
        const fail = (error) => ({
            failure: source.fail({ deps, context, step, error })
        });
        const executeContext = toolContext({ deps, context, name: tool.name });
        const effect = tool.effect(detachJson(step.args), executeContext);
        if (effect !== facts.effect || effect !== 'read') {
            return fail(`${source.label} is no longer classified as a read-only operation.`);
        }
        const display = source.display(deps, step);
        let activity = null;
        let result;
        try {
            const executed = await executeCall(tool, step.args, executeContext, {
                runId: session.runId,
                deniedMessage: context.policy.deniedMessage,
                signal: args.signal,
                sources: [],
                outbound: session.outbound,
                pipeline: session.pipeline,
                callId: step.id,
                effect,
                preflight: readyPreflightFromFacts(facts),
                display,
                onToolActivity: (event) => (activity = event)
            });
            result = executed.result;
        }
        catch (error) {
            if (error instanceof RecoveryRequired || error instanceof ToolPolicyChanged) {
                throw error;
            }
            if (error instanceof AbortedError || args.signal?.aborted) {
                throw new AbortedError();
            }
            return fail(errorMessage(error));
        }
        if (args.signal?.aborted) {
            throw new AbortedError();
        }
        const announce = () => {
            emit({ type: 'tool-call', name: tool.name, args: step.args, effect: 'read', display });
            if (activity) {
                emit(activity);
            }
            emit({ type: 'tool-result', name: tool.name, result });
        };
        return source.settle({ deps, context, step, result, announce });
    };
}
