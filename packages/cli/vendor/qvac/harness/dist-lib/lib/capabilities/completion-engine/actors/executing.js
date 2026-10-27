import { Agent } from '../../../agent/index.js';
import { AbortedError } from '../../../helpers/race-abort.js';
import { spliceFrom } from '../splice.js';
import { answerOf, callSucceeded, readyPreflightFromFacts, reportFailure, settledFailure } from '../tool-execution.js';
import { directToolHistory } from '../turns.js';
import { labelOf } from '../loop.js';
import { DIRECT_CALL_ID, FAILURE_STREAK, TOOL_FAILING_MESSAGE, deliversFile, historyPayload, materializeCompletionHistory, withHookContext, toolResultHistoryEntry, toolResultTurn } from '../../tool-turns.js';
import { defers, TOOL_SEARCH_TOOL_NAME } from '../../sdk-tool.js';
import { executionPlan, trustedSources } from './execution-plan.js';
import { runToolCall } from './execute.js';
import { toolCaller } from '../tool-caller.js';
import { loadSkill } from './loading-skill.js';
import { failureResultRef, storeFailureResult } from '../../../helpers/failure-result.js';
import { runsCheck } from '../../../helpers/goal-check.js';
const CHECK_OUTPUT_CHARS = 2000;
export const executing = async function executing(input) {
    const { emit, input: deps, context } = input;
    const call = context.currentCall;
    const execution = context.execution;
    if (!call || !execution) {
        throw new Error('completion graph selected execution without execution facts');
    }
    const plan = executionPlan(deps, context, { call, execution });
    const { skillName } = plan;
    if (skillName !== null) {
        return loadSkill(input, { ...plan, skillName });
    }
    const direct = execution.kind === 'direct';
    const ran = await runCall(input, { plan, execution, emit });
    const settled = settleCall(input, { ran, direct, emit });
    const { args: callArgs } = plan.resolved;
    const history = direct
        ? directToolHistory(context.history, {
            args: callArgs,
            output: ran.executed.output,
            resultRef: settled.failed?.resultRef,
            nudge: context.policy.continuationNudge
        })
        : [...context.history, settled.entry];
    const succeeded = settled.settled !== undefined;
    const planned = succeeded && plan.resolved.tool.name === Agent.PLAN_TOOL_NAME;
    return {
        deniedKey: settled.deniedKey,
        webSearch: settled.webSearch,
        history: spliceFrom(context.history, history),
        source: settled.source,
        failed: settled.failed,
        progressed: settled.progressed,
        unchanged: settled.unchanged,
        settled: settled.settled,
        stableRead: settled.stableRead,
        answer: settled.answer,
        delivered: settled.delivered,
        endedRun: succeeded && plan.resolved.tool.endsRun === true ? true : undefined,
        durationMs: settled.durationMs,
        checked: settled.checked,
        plan: planned ? Agent.planSteps(callArgs) : undefined,
        leftPlanMode: planned && context.planMode && call.leavesPlan ? true : undefined
    };
};
export async function runCall({ input: deps, context }, { plan: vetted, execution, emit }) {
    const { args, session } = deps;
    const { call, args: callArgs, rawCall, intent } = vetted.resolved;
    const display = labelOf(call.name, callArgs, session.skillIcon);
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const denied = new Set(context.deniedKeys);
    const plan = withRunPorts({ input: deps, context }, { plan: vetted, denied, emit });
    const sources = trustedSources(deps, context);
    const facts = execution.gate?.facts;
    if (!facts) {
        throw new Error('selected tool has no inspected policy facts');
    }
    const preflight = readyPreflightFromFacts(facts);
    if (context.approval.status === 'idle') {
        emit({
            type: 'tool-call',
            name: call.name,
            args: callArgs,
            rawCall,
            effect: plan.effect,
            display
        });
    }
    const landedBefore = session.landed.length;
    const startedAt = Date.now();
    const executed = await runToolCall(plan, {
        approve: context.approval.status === 'idle'
            ? undefined
            : () => Promise.resolve(context.approval.status === 'approved'),
        signal: args.signal,
        denied,
        preflight,
        sources,
        outbound: session.outbound,
        pipeline: session.pipeline,
        runId: session.runId,
        deniedMessage: context.policy.deniedMessage,
        callId: call.id,
        skipApprovals: session.policy.skipApprovals,
        intent,
        display
    });
    const durationMs = Date.now() - startedAt;
    const output = callSucceeded(executed.output, executed.outcome)
        ? executed.output
        : await reportFailure(session.pipeline, {
            runId: session.runId,
            callId: call.id,
            toolName: call.name,
            agentId: context.agentId,
            args: callArgs,
            executed: executed.executed,
            outcome: executed.outcome,
            result: executed.output
        });
    return { plan, denied, landedBefore, executed: { ...executed, output }, durationMs };
}
function withRunPorts({ input: deps, context }, { plan, denied, emit }) {
    const { tool, call } = plan.resolved;
    if (tool.callsTools) {
        const callTool = toolCaller({ input: deps, context }, { callId: call.id, denied, emit });
        return { ...plan, context: { ...plan.context, callTool } };
    }
    if (tool.name === TOOL_SEARCH_TOOL_NAME && deps.session.enabled.some(defers)) {
        const history = materializeCompletionHistory(context.history, context.failureResults);
        return { ...plan, context: { ...plan.context, history } };
    }
    return plan;
}
function silent(output) {
    const text = textsOf(output);
    return (output === null ||
        output === undefined ||
        (text.length > 0 && text.every((each) => each.trim() === '')));
}
function textsOf(value) {
    if (typeof value === 'string') {
        return [value];
    }
    return value && typeof value === 'object' ? Object.values(value).flatMap(textsOf) : [];
}
function failingNoted(context, { key: callKey, output, outcome }) {
    if (!settledFailure(output, outcome)) {
        return output;
    }
    const streak = (context.failureStreaks?.[callKey] ?? 0) + 1;
    return streak % FAILURE_STREAK === 0
        ? withHookContext(output, (context.policy.failingMessage ?? TOOL_FAILING_MESSAGE).replaceAll('{count}', String(streak)))
        : output;
}
export function settleCall({ input: { session }, context }, { ran, direct, emit }) {
    const { plan, denied, landedBefore, executed, durationMs } = ran;
    const { call, key: callKey, args: callArgs } = plan.resolved;
    const { outcome, activity } = executed;
    const succeeded = executed.executed && callSucceeded(executed.output, outcome);
    const digest = succeeded ? session.resultDigest(executed.output) : undefined;
    const prior = context.settledResults[callKey];
    const repeated = digest !== undefined && prior?.digest === digest;
    const unchanged = repeated && !silent(historyPayload(executed.output));
    const output = unchanged && !prior.folded
        ? withHookContext(executed.output, context.policy.unchangedMessage.replaceAll('{count}', String(prior.repeats + 2)))
        : failingNoted(context, { key: callKey, output: executed.output, outcome });
    if (outcome.kind !== 'success' && session.landed.length > landedBefore) {
        session.landed.length = landedBefore;
    }
    session.runOutcomes.record(output, outcome);
    if (activity) {
        emit(activity);
    }
    emit({ type: 'tool-result', name: call.name, result: output });
    const resultTurnId = direct ? DIRECT_CALL_ID : call.id;
    const failed = settledFailure(output, outcome)
        ? {
            key: callKey,
            resultRef: failureResultRef(callKey, context.round, call.id),
            outcome,
            value: {
                name: call.name,
                result: storeFailureResult(output)
            }
        }
        : undefined;
    const turn = toolResultTurn(call.name, resultTurnId, output);
    return {
        deniedKey: [...denied].find((key) => !context.deniedKeys.includes(key)),
        webSearch: plan.webSearch,
        source: session.outbound.facts('tool-result', turn),
        failed,
        progressed: succeeded && !repeated ? true : undefined,
        unchanged: unchanged ? true : undefined,
        settled: digest === undefined ? undefined : { key: callKey, digest },
        stableRead: plan.resolved.tool.stableRead && plan.effect === 'read' ? true : undefined,
        answer: succeeded ? answerOf(output) : undefined,
        delivered: outcome.kind === 'success' && deliversFile(output) ? true : undefined,
        durationMs: executed.executed ? durationMs : undefined,
        checked: executed.executed
            ? checksRun(context, {
                command: callArgs.command,
                passed: succeeded,
                output: executed.output
            })
            : undefined,
        entry: toolResultHistoryEntry({
            name: call.name,
            id: resultTurnId,
            output,
            resultRef: failed?.resultRef
        })
    };
}
function checksRun({ goal }, { command, passed, output }) {
    const ran = typeof command === 'string' && goal
        ? goal.checks.filter((check) => runsCheck(command, check.name))
        : [];
    if (!ran.length) {
        return undefined;
    }
    const tail = textsOf(historyPayload(output)).join('\n').trim().slice(-CHECK_OUTPUT_CHARS);
    return ran.map(({ name }) => ({ name, passed, output: tail }));
}
