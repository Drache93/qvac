import { runToolContext } from './loop.js';
import { AbortedError } from '../../helpers/race-abort.js';
import { RecoveryRequired } from '../../helpers/engine-error.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { approval } from './actors/approval.js';
import { answering } from './actors/answering.js';
import { directSearch } from './actors/direct-search.js';
import { batching } from './actors/batching.js';
import { executing } from './actors/executing.js';
import { finishing } from './actors/finishing.js';
import { inspecting } from './actors/inspecting.js';
import { inspectPrepare } from './actors/inspect-prepare.js';
import { preparing } from './actors/preparing.js';
import { rejecting } from './actors/rejecting.js';
import { resolving } from './actors/resolving.js';
import { retrieving } from './actors/retrieving.js';
import { runPrepare } from './actors/run-prepare.js';
import { skillStep } from './actors/skill-step.js';
import { streaming } from './actors/streaming.js';
import { wrapUp } from './actors/wrap-up.js';
import { toolContext } from './actors/execution-plan.js';
import { capabilityPolicy, captureFacts, restoreFacts, schemaDigest } from './durable.js';
import { bindOperations, toolOperationFacts } from './operations.js';
import { loadedSkills } from './session.js';
import { errorMessage, isRecord } from '../../guards.js';
import { detachJson } from '../../helpers/detach-json.js';
const prepareSource = skillStep;
export function completionPorts(deps) {
    return {
        stages: {
            preparing: stage(deps, preparing(prepareSource)),
            inspectPrepare: stage(deps, inspectPrepare(prepareSource)),
            runPrepare: stage(deps, runPrepare(prepareSource)),
            searching: stage(deps, directSearch),
            generating: stage(deps, streaming),
            resolving: stage(deps, resolving),
            answering: stage(deps, answering),
            retrieving: stage(deps, retrieving),
            inspecting: stage(deps, inspecting),
            rejecting: stage(deps, rejecting),
            approving: stage(deps, approval),
            executing: stage(deps, executing),
            batching: stage(deps, batching),
            wrapping: stage(deps, wrapUp),
            finishing: stage(deps, finishing)
        },
        rebuild: (cx) => rebuildSession(deps, cx),
        lifecycle: (phase, context) => deps.session.pipeline.onRunLifecycle({
            phase,
            runId: context.runId,
            agentId: context.agentId
        }),
        settledResultFacts: (operationId, current) => {
            const receipt = deps.operations.getReceipt(operationId);
            if (receipt?.status !== 'result' || receipt.facts === undefined) {
                return undefined;
            }
            const recorded = toolOperationFacts(receipt.facts);
            const fallback = current ? undefined : captureFacts(deps.session);
            const baseline = current ?? fallback;
            if (!baseline) {
                return undefined;
            }
            const currentBackends = Array.isArray(baseline.backends) ? baseline.backends : [];
            const currentBudget = isRecord(baseline.runBudget)
                ? baseline.runBudget
                : captureFacts(deps.session).runBudget;
            const currentOutcome = isRecord(baseline.outcome) ? baseline.outcome : {};
            const currentWrites = [];
            if (Array.isArray(currentOutcome.confirmedWrites)) {
                for (const entry of currentOutcome.confirmedWrites) {
                    if (typeof entry === 'string') {
                        currentWrites.push(entry);
                    }
                }
            }
            return {
                ...baseline,
                backends: recorded.backends.length > currentBackends.length ? recorded.backends : currentBackends,
                runBudget: {
                    ...currentBudget,
                    outputBytesUsed: Math.max(typeof currentBudget.outputBytesUsed === 'number' ? currentBudget.outputBytesUsed : 0, recorded.runBudget.outputBytesUsed)
                },
                outcome: {
                    ...currentOutcome,
                    confirmedWrites: recorded.outcome.confirmedWrites.length > currentWrites.length
                        ? recorded.outcome.confirmedWrites
                        : currentWrites
                }
            };
        },
        now: deps.session.now
    };
}
function stage(deps, run) {
    return async (cx) => {
        const invocation = bind(deps, cx);
        try {
            return await run(invocation);
        }
        finally {
            invocation.input.commitFacts?.();
        }
    };
}
function bind(deps, cx) {
    const { context, signal, stage } = cx;
    const session = deps.session;
    const local = {
        ...deps,
        args: { ...deps.args, signal: signal }
    };
    local.commitFacts = () => cx.commit(captureFacts(session));
    local.commitSettledFacts = (operationId) => cx.commitSettledResult(operationId);
    local.args = bindOperations(local, context, stage);
    const bound = new Map(local.args.tools?.map((tool) => [tool.name, tool]));
    session.enabled = session.enabled.map((tool) => bound.get(tool.name) ?? tool);
    const acquireRound = local.args.acquireRound;
    if (acquireRound) {
        local.args.acquireRound = async (roundSignal) => {
            try {
                return await acquireRound(roundSignal);
            }
            catch (error) {
                if (signal.aborted || roundSignal?.aborted) {
                    throw new AbortedError();
                }
                throw new RecoveryRequired({
                    id: `${context.runId}:runtime:model`,
                    name: `Model runtime unavailable: ${errorMessage(error)}`,
                    args: { model: local.args.model ?? local.args.modelId },
                    effect: 'read'
                });
            }
        };
    }
    session.toolContext = runToolContext(local.args, session.runBudget);
    return {
        input: local,
        context,
        signal,
        emit: (event) => {
            if (signal.aborted)
                return;
            if (event.type === 'tool-result') {
                local.commitFacts?.();
            }
            const output = {
                ...detachEventPayload(event),
                runId: context.runId,
                round: eventRound(event, context)
            };
            if (event.callId !== undefined) {
                output.callId = event.callId;
            }
            else if (context.currentCall) {
                output.callId = context.currentCall.id;
            }
            else if (stage === 'runPrepare' && context.prepareStep) {
                output.callId = context.prepareStep.id;
            }
            cx.emit(output);
        }
    };
}
function detachEventPayload(event) {
    switch (event.type) {
        case 'inference-call':
            return { ...event, call: detachJson(event.call) };
        case 'inference-sent':
            return { ...event, tokens: detachJson(event.tokens) };
        case 'metrics':
            return {
                ...event,
                backends: detachJson(event.backends),
                usage: detachJson(event.usage)
            };
        case 'tool-call': {
            const payload = {
                ...event,
                args: detachJson(event.args),
                display: detachJson(event.display)
            };
            if (payload.rawCall === undefined) {
                delete payload.rawCall;
            }
            return payload;
        }
        case 'tool-activity':
            return {
                ...event,
                args: detachJson(event.args),
                resource: detachJson(event.resource)
            };
        case 'tool-result':
            return { ...event, result: detachJson(event.result) };
        default:
            return event;
    }
}
function eventRound(event, context) {
    if (event.type === 'inference-sent')
        return event.round;
    if (event.type === 'inference-call')
        return event.call.round;
    return context.round;
}
async function rebuildSession(deps, cx) {
    const { context } = cx;
    const durable = context.durable;
    if (durable) {
        restoreFacts(deps, durable);
    }
    const missingBindings = durable?.bindings.filter((name) => typeof deps.args[name] !== 'function') ?? [];
    if (missingBindings.length) {
        throw new RecoveryRequired({
            id: `${context.runId}:runtime:callbacks`,
            name: `Supply runtime callbacks: ${missingBindings.join(', ')}`,
            args: { callbacks: missingBindings },
            effect: 'read'
        });
    }
    const invocation = bind(deps, cx);
    await preparing(prepareSource)({ ...invocation, reconstruct: true });
    if (durable) {
        restoreFacts(invocation.input, durable);
    }
    const session = deps.session;
    session.reselectTools?.(loadedSkills(context, session));
    const missing = context.availableTools.filter((name) => !session.enabled.some((tool) => tool.name === name));
    const changed = durable?.tools
        .filter((saved) => {
        const tool = session.enabled.find((tool) => tool.name === saved.name);
        return (!tool ||
            saved.description !== tool.description ||
            stableStringify(saved.prompt) !== stableStringify(tool.prompt ?? null) ||
            saved.policyVersion !== (tool.policyVersion ?? null) ||
            saved.parametersDigest !== schemaDigest(tool.parameters) ||
            saved.toolset !== tool.toolset ||
            saved.autoApprove !== (tool.autoApprove === true) ||
            saved.externalWrite !== (tool.externalWrite === true) ||
            saved.owningSkill !== (tool.owningSkill ?? null) ||
            saved.skillGated !== (tool.skillGated === true) ||
            saved.rootsRequired !== (tool.rootsRequired === true) ||
            saved.writeRootsRequired !== (tool.writeRootsRequired === true) ||
            saved.compiled !== (tool.compiled === true) ||
            (saved.defer === true) !== (tool.defer === true));
    })
        .map((tool) => tool.name) ?? [];
    const added = durable?.runStarted
        ? session.enabled
            .filter((tool) => !durable.tools.some((saved) => saved.name === tool.name))
            .map((tool) => tool.name)
        : [];
    const policyChanged = durable?.runStarted &&
        stableStringify(durable.policy) !== stableStringify(capabilityPolicy(session));
    const call = context.currentCall;
    const inFlight = call && session.enabled.find((tool) => tool.name === call.name);
    const effectChanged = call &&
        inFlight &&
        context.execution &&
        inFlight.effect(detachJson(call.args), toolContext({ deps: invocation.input, context, name: call.name })) !== context.execution.effect
        ? [call.name]
        : [];
    const drifted = [...new Set([...missing, ...changed, ...added, ...effectChanged])];
    if (drifted.length) {
        throw new Error(`Tools changed since this run paused: ${drifted.join(', ')}`);
    }
    if (policyChanged) {
        throw new Error('Capabilities changed since this run paused');
    }
}
