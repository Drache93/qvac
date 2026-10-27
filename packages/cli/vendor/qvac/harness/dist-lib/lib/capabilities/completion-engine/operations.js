import { createHash } from 'crypto';
import { normalizeToolExecutionOutcome, writeResult } from '../../helpers/run-outcome.js';
import { isMetadataMethod } from '../../helpers/mcp-methods.js';
import { captureFacts, captureToolOperationFacts, restoreFacts } from './durable.js';
import { AbortedError } from '../../helpers/race-abort.js';
import { isRecord } from '../../guards.js';
import { detachJson } from '../../helpers/detach-json.js';
export class ToolPolicyChanged extends Error {
    constructor(tool) {
        super(`Tool effect changed after approval: ${tool}`);
        this.name = 'ToolPolicyChanged';
    }
}
const basePipelines = new WeakMap();
function digestArgs(payload) {
    const entries = Object.entries(payload);
    const messages = entries.find(([key]) => key === 'messages')?.[1];
    if (!Array.isArray(messages)) {
        return Object.fromEntries(entries);
    }
    const rest = Object.fromEntries(entries.filter(([key]) => key !== 'messages'));
    return {
        ...rest,
        messages: {
            count: messages.length,
            sha256: createHash('sha256').update(JSON.stringify(messages)).digest('hex')
        }
    };
}
function digestText(text) {
    return { length: text.length, sha256: createHash('sha256').update(text).digest('hex') };
}
function isBackendUse(value) {
    return (isRecord(value) &&
        typeof value.tool === 'string' &&
        typeof value.requestedGpu === 'boolean' &&
        (value.device === 'gpu' || value.device === 'cpu' || value.device === 'unknown') &&
        typeof value.backend === 'string');
}
export function toolOperationFacts(value) {
    if (!isRecord(value) || !Array.isArray(value.backends) || !isRecord(value.runBudget)) {
        throw new TypeError('Malformed tool operation facts');
    }
    const backends = value.backends.filter(isBackendUse);
    const runBudget = value.runBudget.outputBytesUsed;
    const outcome = value.outcome;
    if (backends.length !== value.backends.length ||
        typeof runBudget !== 'number' ||
        !Number.isSafeInteger(runBudget) ||
        runBudget < 0 ||
        !isRecord(outcome) ||
        !Array.isArray(outcome.confirmedWrites)) {
        throw new TypeError('Malformed tool operation facts');
    }
    const confirmedWrites = outcome.confirmedWrites.filter((entry) => typeof entry === 'string');
    if (confirmedWrites.length !== outcome.confirmedWrites.length) {
        throw new TypeError('Malformed tool operation facts');
    }
    return { backends, runBudget: { outputBytesUsed: runBudget }, outcome: { confirmedWrites } };
}
function runHookOperation({ deps, base, phase, id, name, payload, check, run }) {
    check();
    if (!base.hasPhase(phase)) {
        return run();
    }
    return deps.operations.operation({ id, name, args: digestArgs(payload), effect: 'read' }, run, undefined, deps.args.signal);
}
function wrapHostCallback({ deps, check, prefix, stage, callId, name, effect, callback }) {
    let count = 0;
    return async (input) => {
        const release = deps.session.trackInvoke();
        try {
            check();
            const journalInput = detachHostCallbackInput(input);
            const callbackInput = detachHostCallbackInput(journalInput);
            return await deps.operations.operation({
                id: `${prefix}:${stage}:${callId}:host-${name}-${count++}`,
                name: `host:${name}`,
                args: [journalInput],
                effect
            }, () => callback(callbackInput).then((result) => detachJson(result)), undefined, deps.args.signal);
        }
        finally {
            release();
        }
    };
}
function detachHostCallbackInput(input) {
    const detached = detachJson(input);
    if (isRecord(input) && input.bytes instanceof Uint8Array) {
        Reflect.set(detached, 'bytes', Uint8Array.from(input.bytes));
    }
    return detached;
}
function plannedEffect(context, { stage, callId, name }) {
    if (context.execution && context.currentCall?.name === name) {
        return context.execution.effect;
    }
    const queued = stage === 'batching' && context.toolQueue.find((call) => call.id === callId);
    return queued && queued.concurrent && queued.name === name ? 'read' : undefined;
}
export function bindOperations(deps, context, stage) {
    const args = { ...deps.args };
    const prefix = `${context.runId}:round-${context.round}`;
    const check = () => {
        if (args.signal?.aborted)
            throw new AbortedError();
    };
    args.tools = args.tools?.map((tool) => ({
        ...tool,
        execute: async (resolved, runtime) => {
            const step = context.prepareStep;
            const call = runtime?.callId ?? context.currentCall?.id ?? step?.id ?? `preload-${tool.name}`;
            const id = `${prefix}:${call}:execute`;
            const effect = tool.effect(detachJson(resolved), runtime);
            if (stage === 'runPrepare' &&
                step &&
                tool.name === step.tool &&
                (step.facts?.effect !== 'read' || effect !== 'read')) {
                throw new ToolPolicyChanged(tool.name);
            }
            const planned = plannedEffect(context, { stage, callId: runtime?.callId, name: tool.name });
            if (planned && effect !== planned) {
                throw new ToolPolicyChanged(tool.name);
            }
            check();
            const result = await deps.operations.operation({
                id,
                name: tool.name,
                args: resolved,
                effect
            }, async () => {
                const result = await tool.execute(resolved, runtime);
                confirm(result);
                return result;
            }, {
                capture: () => captureToolOperationFacts(deps.session),
                restore: (facts) => {
                    const recorded = toolOperationFacts(facts);
                    const current = captureFacts(deps.session);
                    restoreFacts(deps, {
                        ...current,
                        backends: recorded.backends.length > current.backends.length
                            ? recorded.backends
                            : current.backends,
                        runBudget: {
                            deadlineMs: current.runBudget.deadlineMs,
                            outputBytesUsed: Math.max(current.runBudget.outputBytesUsed, recorded.runBudget.outputBytesUsed)
                        },
                        outcome: {
                            ...current.outcome,
                            confirmedWrites: recorded.outcome.confirmedWrites.length > current.outcome.confirmedWrites.length
                                ? recorded.outcome.confirmedWrites
                                : current.outcome.confirmedWrites
                        }
                    });
                }
            }, args.signal);
            const receipt = deps.operations.getReceipt(id);
            if (receipt?.status === 'result' && receipt.facts === undefined) {
                confirm(result);
                await deps.operations.commitResultFacts(id, captureToolOperationFacts(deps.session));
            }
            if (args.signal?.aborted && deps.operations.getReceipt(id)?.status === 'result') {
                deps.commitSettledFacts?.(id);
            }
            return result;
            function confirm(result) {
                if (effect === 'write' &&
                    normalizeToolExecutionOutcome(result, { kind: 'success' }).kind === 'success') {
                    const written = tool.landedWrite?.(detachJson(resolved), detachJson(result)) ??
                        ((tool.toolset === 'mcp-call' && !isMetadataMethod(resolved.method)) ||
                            (tool.compiled === true && tool.toolset === 'http-request')
                            ? writeResult(result)
                            : null);
                    if (written) {
                        deps.session.landed.push(written);
                    }
                }
            }
        }
    }));
    if (args.attach) {
        args.attach = wrapHostCallback({
            deps,
            check,
            prefix,
            stage,
            callId: context.currentCall?.id ?? 'prepare',
            name: 'attach',
            effect: 'write',
            callback: args.attach
        });
    }
    if (args.askUser) {
        args.askUser = wrapHostCallback({
            deps,
            check,
            prefix,
            stage,
            callId: context.currentCall?.id ?? 'prepare',
            name: 'askUser',
            effect: 'read',
            callback: args.askUser
        });
    }
    const base = basePipelines.get(deps.session) ?? deps.session.pipeline;
    basePipelines.set(deps.session, base);
    const pipeline = Object.create(base);
    deps.session.pipeline = pipeline;
    let startCount = 0;
    pipeline.onRunStart = async (payload) => {
        await runHookOperation({
            deps,
            base,
            phase: 'runStart',
            id: `${prefix}:${stage}:run:hook-onRunStart-${startCount++}`,
            name: 'hook:onRunStart',
            payload,
            check,
            run: () => base.onRunStart(payload)
        });
    };
    let preToolCount = 0;
    pipeline.runPreToolFold = async (payload) => {
        const { signal: _signal, egress: _egress, command: _command, paths: _paths, ...durable } = payload;
        return runHookOperation({
            deps,
            base,
            phase: 'preToolCall',
            id: `${prefix}:${stage}:${payload.callId}:hook-runPreToolFold-${preToolCount++}`,
            name: 'hook:runPreToolFold',
            payload: durable,
            check,
            run: () => base.runPreToolFold(payload)
        });
    };
    const postToolCounts = new Map();
    pipeline.runPostToolFold = async (payload) => {
        const count = postToolCounts.get(payload.callId) ?? 0;
        postToolCounts.set(payload.callId, count + 1);
        return runHookOperation({
            deps,
            base,
            phase: 'postToolCall',
            id: `${prefix}:${stage}:${payload.callId}:hook-runPostToolFold-${count}`,
            name: 'hook:runPostToolFold',
            payload,
            check,
            run: () => base.runPostToolFold(payload)
        });
    };
    let promptCount = 0;
    pipeline.promptSubmit = async (payload) => {
        const { text, ...rest } = payload;
        return runHookOperation({
            deps,
            base,
            phase: 'promptSubmit',
            id: `${prefix}:${stage}:run:hook-promptSubmit-${promptCount++}`,
            name: 'hook:promptSubmit',
            payload: { ...rest, text: digestText(text) },
            check,
            run: () => base.promptSubmit(payload)
        });
    };
    const failureCounts = new Map();
    pipeline.toolFailure = async (payload) => {
        const count = failureCounts.get(payload.callId) ?? 0;
        failureCounts.set(payload.callId, count + 1);
        return runHookOperation({
            deps,
            base,
            phase: 'toolFailure',
            id: `${prefix}:${stage}:${payload.callId}:hook-toolFailure-${count}`,
            name: 'hook:toolFailure',
            payload,
            check,
            run: () => base.toolFailure(payload)
        });
    };
    let stopCount = 0;
    pipeline.stop = async (payload) => {
        const { response, ...rest } = payload;
        return runHookOperation({
            deps,
            base,
            phase: 'stop',
            id: `${prefix}:${stage}:run:hook-stop-${stopCount++}`,
            name: 'hook:stop',
            payload: { ...rest, response: digestText(response) },
            check,
            run: () => base.stop(payload)
        });
    };
    let foldCount = 0;
    pipeline.preFold = async (payload) => runHookOperation({
        deps,
        base,
        phase: 'preFold',
        id: `${prefix}:${stage}:run:hook-preFold-${foldCount++}`,
        name: 'hook:preFold',
        payload,
        check,
        run: () => base.preFold(payload)
    });
    return args;
}
