import { spliceFrom } from '../splice.js';
import { directToolHistory } from '../turns.js';
import { labelOf } from '../loop.js';
import { toolResultHistoryEntry, toolResultTurn } from '../../tool-turns.js';
import { readFailureResult, storeFailureResult } from '../../../helpers/failure-result.js';
import { reportFailure } from '../tool-execution.js';
export const rejecting = async function rejecting({ emit, input: { session }, context }) {
    const rejected = context.rejectedCall;
    if (!rejected) {
        throw new Error('completion graph selected rejection without a rejected call');
    }
    const { call } = rejected;
    const refused = rejected.resultRef
        ? failureResult(context, rejected.resultRef, call.name)
        : rejected.result;
    const outcome = rejected.repeat ??
        rejected.outcome ?? { kind: 'blocked', reason: 'Tool call was rejected' };
    const result = rejected.repeat
        ? refused
        : await reportFailure(session.pipeline, {
            runId: session.runId,
            callId: call.id,
            toolName: call.name,
            agentId: context.agentId,
            args: call.args,
            executed: false,
            outcome,
            result: refused
        });
    session.runOutcomes.record(result, outcome);
    if (rejected.emitCall) {
        emit({
            type: 'tool-call',
            name: call.name,
            args: call.args,
            rawCall: call.rawCall,
            effect: rejected.effect,
            display: labelOf(call.name, call.args, session.skillIcon)
        });
    }
    if (rejected.activity) {
        emit(rejected.activity);
    }
    if (rejected.emitResult) {
        emit({ type: 'tool-result', name: call.name, result });
    }
    const turn = toolResultTurn(call.name, call.id, result);
    const history = context.execution?.kind === 'direct'
        ? directToolHistory(context.history, {
            args: call.args,
            output: result,
            resultRef: rejected.resultRef,
            nudge: context.policy.continuationNudge
        })
        : [
            ...context.history,
            toolResultHistoryEntry({
                name: call.name,
                id: call.id,
                output: result,
                resultRef: rejected.resultRef
            })
        ];
    const failed = rejected.outcome && rejected.outcome.kind !== 'denied' && !rejected.repeat
        ? {
            key: call.key,
            resultRef: requiredFailureRef(rejected.resultRef),
            outcome: rejected.outcome,
            value: result === refused ? undefined : { name: call.name, result: storeFailureResult(result) }
        }
        : undefined;
    return {
        deniedKey: rejected.deniedKey,
        failed,
        searchCapped: rejected.capped,
        blockedRepeat: rejected.repeat ? true : undefined,
        history: spliceFrom(context.history, history),
        source: session.outbound.facts(rejected.source, turn)
    };
};
function failureResult(context, ref, name) {
    const stored = context.failureResults[ref];
    if (!stored || stored.name !== name) {
        throw new Error(`Rejected call references missing or mismatched failure result: ${ref}`);
    }
    return readFailureResult(stored.result);
}
function requiredFailureRef(ref) {
    if (ref === undefined) {
        throw new Error('Memoized rejected call has no failure result reference');
    }
    return ref;
}
