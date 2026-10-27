import { Agent } from '../../agent/index.js';
import { isRecord } from '../../guards.js';
import { detachJson } from '../../helpers/detach-json.js';
import { AbortedError, raceAbort } from '../../helpers/race-abort.js';
import { CompletionMachine } from '../../machine/index.js';
import { historyPayload } from '../tool-turns.js';
import { defers, TOOL_SEARCH_TOOL_NAME, unloadedTools } from '../sdk-tool.js';
import { labelOf } from './loop.js';
import { ToolPolicyChanged } from './operations.js';
import { callSucceeded, executeCall, preflightToolCall, reportFailure, ruleInputs } from './tool-execution.js';
import { toolContext, trustedSources } from './actors/execution-plan.js';
export const MAX_SCRIPT_CALLS = 16;
function callable(tool) {
    return (tool.callsTools !== true &&
        tool.endsRun !== true &&
        tool.name !== Agent.SKILL_TOOL_NAME &&
        tool.name !== Agent.WEB_SEARCH_TOOL_NAME);
}
function heldTo(tool, effect) {
    return {
        ...tool,
        execute: (args, ctx) => {
            if (tool.effect(detachJson(args), ctx) !== effect) {
                throw new ToolPolicyChanged(tool.name);
            }
            return tool.execute(args, ctx);
        }
    };
}
function refusal(hookError, planModeWrite) {
    if (hookError !== null) {
        return { error: hookError, guidance: true };
    }
    return planModeWrite ? { error: CompletionMachine.PLAN_MODE_REFUSAL, guidance: true } : null;
}
export function toolCaller({ input: deps, context }, { callId, denied, emit }) {
    const { args, session } = deps;
    const hidden = unloadedTools(session.enabled, context.history);
    if (session.enabled.some(defers)) {
        hidden.add(TOOL_SEARCH_TOOL_NAME);
    }
    const reachable = (tool) => callable(tool) && !hidden.has(tool.name);
    const names = session.enabled.filter(reachable).map((tool) => tool.name);
    let count = 0;
    let queue = Promise.resolve();
    const one = async (name, input) => {
        if (args.signal?.aborted) {
            throw new AbortedError();
        }
        if (count >= MAX_SCRIPT_CALLS) {
            throw new Error(`A script makes at most ${MAX_SCRIPT_CALLS} tool calls.`);
        }
        const id = `${callId}.${++count}`;
        const tool = session.enabled.find((tool) => tool.name === name && reachable(tool));
        if (!tool) {
            return { error: `No tool named ${String(name)} can be called from a script.` };
        }
        if (!isRecord(input) || Array.isArray(input)) {
            return { error: `${name} takes an object of arguments.` };
        }
        const ctx = toolContext({ deps, context, name });
        const fold = await session.pipeline.runPreToolFold({
            runId: session.runId,
            callId: id,
            toolName: name,
            agentId: context.agentId,
            effect: tool.effect(detachJson(input), ctx),
            resource: detachJson(tool.resource?.(detachJson(input), ctx) ?? null),
            args: detachJson(input),
            skillNames: session.inContextSkills.map((skill) => skill.name),
            parameters: tool.parameters,
            egress: tool.egress,
            ...ruleInputs(tool, ctx),
            network: session.access?.network.mode ?? 'on',
            signal: args.signal
        });
        const callArgs = detachJson(fold.ok ? fold.args : input);
        const preflight = preflightToolCall(tool, callArgs, ctx, {
            ...trustedSources(deps, context),
            outbound: session.outbound,
            denied,
            key: session.callKey(name, callArgs),
            deniedMessage: context.policy.deniedMessage,
            skipApprovals: session.policy.skipApprovals,
            permission: fold.ok ? fold.permission : undefined
        });
        const effect = preflight.status === 'denied' ? 'write' : preflight.effect;
        const display = labelOf(name, callArgs, session.skillIcon);
        emit({ type: 'tool-call', name, args: callArgs, effect, display });
        const failure = (result, outcome, ran) => reportFailure(session.pipeline, {
            runId: session.runId,
            callId: id,
            toolName: name,
            agentId: context.agentId,
            args: callArgs,
            executed: ran?.executed === true,
            outcome,
            result
        });
        const blocked = refusal(fold.ok ? null : fold.rejection.error, context.planMode && preflight.status === 'ready' && effect === 'write');
        if (blocked) {
            const refused = await failure(blocked, { kind: 'blocked', reason: blocked.error }, null);
            emit({
                type: 'tool-activity',
                name,
                args: callArgs,
                resource: null,
                effect,
                decision: 'blocked'
            });
            emit({ type: 'tool-result', name, result: refused });
            return refused;
        }
        const approve = args.approve;
        const landedBefore = session.landed.length;
        const executed = await executeCall(heldTo(tool, effect), callArgs, ctx, {
            runId: session.runId,
            deniedMessage: context.policy.deniedMessage,
            approve: approve &&
                ((request) => deps.operations.operation({
                    id: `${context.runId}:round-${context.round}:${id}:approve`,
                    name: 'human:approve',
                    args: request.arguments,
                    effect: 'read'
                }, () => raceAbort(approve({ ...request, callId: id, round: context.round }), args.signal), undefined, args.signal)),
            signal: args.signal,
            denied,
            preflight,
            outbound: session.outbound,
            pipeline: session.pipeline,
            callId: id,
            skipApprovals: session.policy.skipApprovals,
            display,
            onToolActivity: emit
        });
        if (executed.outcome.kind !== 'success' && session.landed.length > landedBefore) {
            session.landed.length = landedBefore;
        }
        const result = callSucceeded(executed.result, executed.outcome)
            ? executed.result
            : await failure(executed.result, executed.outcome, executed);
        session.runOutcomes.record(result, executed.outcome);
        emit({ type: 'tool-result', name, result });
        return historyPayload(result);
    };
    const call = (name, input) => {
        const next = queue.then(() => one(name, input));
        queue = next;
        return next;
    };
    return Object.assign(call, { names });
}
