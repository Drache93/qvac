import { HookHalt, RecoveryRequired } from '../../helpers/engine-error.js';
import { AbortedError, raceAbort } from '../../helpers/race-abort.js';
import { errorCode, errorMessage, isRecord } from '../../guards.js';
import { detachJson } from '../../helpers/detach-json.js';
import { clipRawCall, normalizeToolArgs } from '../../helpers/tool-call-markup.js';
import { INTENT_PARAM, takeToolIntent } from '../../helpers/tool-intent.js';
import { withHookContext } from '../tool-turns.js';
import { HarnessLog } from '../../log.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { CompletionMachine } from '../../machine/index.js';
import { ToolPolicyChanged } from './operations.js';
import { toolDeniedResult } from '../../helpers/failure-result.js';
function validationMessage(result) {
    return isRecord(result) && 'error' in result ? result.error : result;
}
const RETRYABLE_STATUS = new Set([408, 429]);
const RETRYABLE_CODE = new Set(['timeout', 'transport', 'busy']);
export function callSucceeded(result, outcome) {
    if (outcome.kind !== 'success') {
        return false;
    }
    const exitCode = result === null || result === undefined ? undefined : Reflect.get(Object(result), 'exitCode');
    return typeof exitCode !== 'number' || exitCode === 0;
}
export function answerOf(result) {
    if (!isRecord(result) || result.answer !== true || typeof result.content !== 'string') {
        return undefined;
    }
    return result.content.trim() ? result.content : undefined;
}
function retryHints(result) {
    if (!isRecord(result) || Array.isArray(result)) {
        return {};
    }
    const hints = {};
    if (typeof result.status === 'number') {
        hints.status = result.status;
    }
    if (typeof result.code === 'string') {
        hints.code = result.code;
    }
    return hints;
}
export function settledFailure(result, outcome) {
    if (outcome.kind === 'denied' || callSucceeded(result, outcome)) {
        return false;
    }
    if (outcome.kind === 'error' && outcome.error !== undefined) {
        return false;
    }
    const { code, status } = retryHints(result);
    if (code !== undefined && RETRYABLE_CODE.has(code)) {
        return false;
    }
    return status === undefined || (status < 500 && !RETRYABLE_STATUS.has(status));
}
export function preflightToolCall(tool, args, ctx, options) {
    const facts = inspectToolPolicy(tool, args, ctx, options);
    if (facts.validationError) {
        return {
            status: 'blocked',
            reason: 'validation',
            result: { error: facts.validationError, guidance: true },
            effect: 'write'
        };
    }
    if (facts.refusal) {
        return {
            status: 'blocked',
            reason: 'refusal',
            result: { error: facts.refusal, guidance: true },
            effect: facts.effect
        };
    }
    if (facts.deniedKey) {
        return {
            status: 'denied',
            result: toolDeniedResult(options.deniedMessage),
            key: facts.deniedKey
        };
    }
    return {
        status: 'ready',
        key: facts.key,
        effect: facts.effect,
        resource: facts.resource,
        autoRun: CompletionMachine.runsUnasked(facts),
        permission: facts.permission
    };
}
export function inspectToolPolicy(tool, args, ctx, options) {
    const validationError = tool.validate?.(detachJson(args), ctx) || null;
    const key = options.key ?? toolCallKey(tool.name, args);
    const refusal = validationError
        ? null
        : options.outbound.check(tool.name, args, {
            sources: options.sources ?? [],
            sourceFacts: options.sourceFacts,
            externalWrite: tool.externalWrite === true
        });
    const deniedKey = !validationError && !refusal && options.denied?.has(key) ? key : null;
    const effect = options.effect ?? (validationError ? 'write' : tool.effect(detachJson(args), ctx));
    const resource = validationError || deniedKey ? null : detachJson(tool.resource?.(detachJson(args), ctx) ?? null);
    const facts = {
        key,
        validationError,
        refusal,
        deniedKey,
        effect,
        autoApprove: tool.autoApprove === true,
        skipApprovals: options.skipApprovals === true,
        resource
    };
    if (options.permission) {
        facts.permission = options.permission;
    }
    return facts;
}
export function readyPreflightFromFacts(facts) {
    if (facts.validationError || facts.refusal || facts.deniedKey) {
        throw new Error('tool policy facts are not ready for execution');
    }
    return {
        status: 'ready',
        key: facts.key,
        effect: facts.effect,
        resource: facts.resource,
        autoRun: CompletionMachine.runsUnasked(facts),
        permission: facts.permission
    };
}
function decisionFor(options) {
    if (options.permission !== undefined) {
        return options.approved ? 'allowed' : 'denied';
    }
    if (options.autoApprove || options.effect === 'read') {
        return 'auto';
    }
    if (options.skipApprovals === true) {
        return 'skip-all';
    }
    if (options.approved) {
        return 'allowed';
    }
    return 'denied';
}
export async function executeCall(tool, args, ctx, { runId, deniedMessage, approve, signal, denied, sources = [], sourceFacts = [], outbound, pipeline, callId, effect: classified, skipApprovals, preflight: prepared, onToolActivity, intent, display }) {
    const preflight = prepared ??
        preflightToolCall(tool, args, ctx, {
            deniedMessage,
            sources,
            sourceFacts,
            outbound,
            denied,
            effect: classified,
            skipApprovals
        });
    if (preflight.status === 'blocked' && preflight.reason === 'validation') {
        HarnessLog.info('tool rejected: arguments failed validation', { tool: tool.name });
        return {
            result: preflight.result,
            outcome: { kind: 'guidance', message: String(validationMessage(preflight.result)) },
            executed: false
        };
    }
    if (preflight.status === 'blocked') {
        HarnessLog.info('tool refused: unverifiable value in payload', { tool: tool.name });
        onToolActivity?.({
            type: 'tool-activity',
            name: tool.name,
            args,
            resource: detachJson(tool.resource?.(detachJson(args), ctx) ?? null),
            effect: preflight.effect,
            decision: 'blocked'
        });
        return {
            result: preflight.result,
            outcome: { kind: 'blocked', reason: String(validationMessage(preflight.result)) },
            executed: false
        };
    }
    if (preflight.status === 'denied') {
        HarnessLog.info('tool denied already, not asking again', { tool: tool.name });
        return {
            result: preflight.result,
            outcome: { kind: 'denied', reason: deniedMessage },
            executed: false
        };
    }
    const { key, effect, resource, autoRun, permission } = preflight;
    HarnessLog.info('tool decision', {
        tool: tool.name,
        effect,
        auto: autoRun,
        asks: Boolean(approve)
    });
    let approved = autoRun;
    if (!approved && approve) {
        approved = await raceAbort(approve({
            name: tool.name,
            arguments: detachJson(args),
            resource: detachJson(resource),
            effect,
            intent: intent ?? null,
            display: detachJson(display ?? null),
            quote: tool.quote?.(detachJson(args), ctx)
        }), signal);
    }
    HarnessLog.info(`tool ${approved ? 'approved' : 'denied'}`, { tool: tool.name });
    const decision = decisionFor({
        autoApprove: tool.autoApprove === true,
        effect,
        skipApprovals,
        approved,
        permission
    });
    onToolActivity?.({ type: 'tool-activity', name: tool.name, args, resource, effect, decision });
    if (!approved) {
        denied?.add(key);
        return {
            result: toolDeniedResult(deniedMessage),
            outcome: { kind: 'denied', reason: deniedMessage },
            executed: false
        };
    }
    if (signal?.aborted) {
        throw new AbortedError();
    }
    let output;
    let outcome = { kind: 'success' };
    const toolArgs = detachJson(args);
    try {
        output = await tool.execute(toolArgs, { ...ctx, signal, runId, callId, approval: decision });
        HarnessLog.debug('tool done', { tool: tool.name });
    }
    catch (err) {
        if (err instanceof RecoveryRequired ||
            err instanceof ToolPolicyChanged ||
            err instanceof HookHalt) {
            throw err;
        }
        if (err instanceof AbortedError || signal?.aborted) {
            throw new AbortedError();
        }
        const message = errorMessage(err);
        HarnessLog.warn('tool failed', { tool: tool.name, err: message });
        output = { error: message, code: errorCode(err) };
        outcome = { kind: 'error', message, error: err };
    }
    const folded = await pipeline.runPostToolFold({
        runId,
        callId,
        toolName: tool.name,
        args: toolArgs,
        effect,
        resource,
        toolset: tool.toolset,
        agentId: ctx.agentId ?? null,
        result: output,
        outcome,
        executed: true
    });
    return {
        result: detachJson(withHookContext(folded.result, folded.context)),
        outcome: folded.outcome ?? outcome,
        executed: true
    };
}
export async function reportFailure(pipeline, failure) {
    const context = await pipeline.toolFailure(failure);
    return withHookContext(failure.result, context);
}
export function ruleInputs(tool, ctx) {
    const { paths } = tool;
    return { command: tool.command, paths: paths && ((args) => paths(args, ctx)) };
}
export async function resolveToolCalls(toolCalls, enabled, { runId, agentId, pipeline, skillNames, network, toolContext, signal }) {
    const resolved = [];
    for (const call of toolCalls) {
        if (signal?.aborted) {
            throw new AbortedError();
        }
        const tool = enabled.find((t) => t.name === call.name);
        const rawCall = call.raw === undefined ? {} : { rawCall: clipRawCall(call.raw) };
        if (!tool) {
            resolved.push({ call, args: detachJson(takeToolIntent(call.arguments).args), ...rawCall });
            continue;
        }
        const taken = INTENT_PARAM in tool.parameters.properties
            ? { args: call.arguments }
            : takeToolIntent(call.arguments);
        const intent = taken.intent ? { intent: taken.intent } : {};
        const args = normalizeToolArgs(taken.args, Object.keys(tool.parameters.properties));
        const ctx = toolContext(tool.name);
        const fold = await pipeline.runPreToolFold({
            runId,
            callId: call.id,
            toolName: tool.name,
            effect: tool.effect(detachJson(args), ctx),
            resource: detachJson(tool.resource?.(detachJson(args), ctx) ?? null),
            args,
            agentId,
            skillNames,
            parameters: tool.parameters,
            egress: tool.egress,
            ...ruleInputs(tool, ctx),
            network,
            signal
        });
        const permission = fold.ok && fold.permission ? { permission: fold.permission } : {};
        resolved.push(fold.ok
            ? { call, tool, args: detachJson(fold.args), ...rawCall, ...intent, ...permission }
            : { call, tool, args: detachJson(args), rejection: fold.rejection, ...rawCall, ...intent });
    }
    return resolved;
}
function toolCallKey(name, args) {
    try {
        return `${name}:${stableStringify(args)}`;
    }
    catch {
        return name;
    }
}
