import { AbortedError } from '../../../helpers/race-abort.js';
import { copy } from '../../../helpers/copy.js';
import { inspectToolPolicy, ruleInputs } from '../tool-execution.js';
import { toolContext, trustedSources } from './execution-plan.js';
export function inspectPrepare(source) {
    return async function inspectPrepare({ input: deps, context }) {
        const { args, session } = deps;
        const step = context.prepareStep;
        if (!step) {
            throw new Error('prepare inspection requires a requested step');
        }
        const tool = session.enabled.find((tool) => tool.name === step.tool);
        if (!tool) {
            throw new Error(`prepare step requires the ${step.tool} tool`);
        }
        if (args.signal?.aborted) {
            throw new AbortedError();
        }
        const stepArgs = copy(step.args);
        const executeContext = toolContext({ deps, context, name: tool.name });
        const fold = await session.pipeline.runPreToolFold({
            runId: session.runId,
            callId: step.id,
            toolName: tool.name,
            agentId: context.agentId,
            effect: tool.effect(copy(stepArgs), executeContext),
            resource: copy(tool.resource?.(copy(stepArgs), executeContext) ?? null),
            args: stepArgs,
            skillNames: session.inContextSkills.map((skill) => skill.name),
            parameters: tool.parameters,
            egress: tool.egress,
            ...ruleInputs(tool, executeContext),
            network: session.access?.network.mode ?? 'on',
            signal: args.signal
        });
        if (args.signal?.aborted) {
            throw new AbortedError();
        }
        if (!fold.ok) {
            return {
                tool: step.tool,
                args: stepArgs,
                facts: null,
                hookRejection: fold.rejection,
                failure: source.fail({ deps, context, step, error: fold.rejection.error })
            };
        }
        const facts = inspectToolPolicy(tool, fold.args, executeContext, {
            ...trustedSources(deps, context),
            outbound: session.outbound,
            denied: new Set(context.deniedKeys),
            key: session.callKey(tool.name, fold.args),
            skipApprovals: false
        });
        const failureReason = facts.validationError ??
            facts.refusal ??
            (facts.deniedKey ? context.policy.deniedMessage : null) ??
            (facts.effect !== 'read' ? `${source.label} requires a read-only tool.` : null) ??
            (fold.permission === 'ask' ? `${source.label} requires a call that runs unasked.` : null);
        return {
            tool: step.tool,
            args: copy(fold.args),
            facts,
            hookRejection: null,
            failure: failureReason ? source.fail({ deps, context, step, error: failureReason }) : null
        };
    };
}
