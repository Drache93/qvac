import { CompletionMachine } from '../../../machine/index.js';
import { toolDeniedResult } from '../../../helpers/failure-result.js';
export function policyActivity({ call, effect, resource, decision = 'blocked' }) {
    return {
        type: 'tool-activity',
        name: call.name,
        args: call.args,
        resource,
        effect: effect ?? 'write',
        decision
    };
}
export function gateRejection({ context, call, execution, resource, source }) {
    const facts = execution?.gate?.facts;
    if (!facts) {
        return undefined;
    }
    const effect = execution.effect;
    if (facts.validationError) {
        return {
            result: { error: facts.validationError, guidance: true },
            outcome: { kind: 'guidance', message: facts.validationError },
            activity: null,
            effect,
            source
        };
    }
    if (facts.refusal) {
        return {
            result: { error: facts.refusal, guidance: true },
            outcome: { kind: 'blocked', reason: facts.refusal },
            activity: policyActivity({ call, effect, resource }),
            effect,
            source
        };
    }
    if (facts.deniedKey) {
        return {
            result: toolDeniedResult(context.policy.deniedMessage),
            outcome: { kind: 'denied', reason: context.policy.deniedMessage },
            activity: null,
            effect,
            source
        };
    }
    return undefined;
}
export function deniedWithoutApprover({ context, call, execution, source }) {
    const gate = execution?.gate;
    const facts = gate?.facts;
    if (!gate || !facts) {
        return undefined;
    }
    if (CompletionMachine.runsUnasked(facts) || context.approval.status !== 'idle' || gate.approver) {
        return undefined;
    }
    return {
        result: toolDeniedResult(context.policy.deniedMessage),
        outcome: { kind: 'denied', reason: context.policy.deniedMessage },
        activity: policyActivity({
            call,
            effect: facts.effect,
            resource: facts.resource,
            decision: 'denied'
        }),
        effect: execution.effect,
        source,
        deniedKey: facts.key
    };
}
