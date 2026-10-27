import b4a from 'b4a';
import { randomBytes, createHmac } from 'crypto';
import { createRunBudget, runToolContext, reportLandedWrites } from './loop.js';
import { cancelledRound, metricsEvent } from './metrics.js';
import { usageBreakdown } from '../usage-breakdown.js';
import { CompletionMachine } from '../../machine/index.js';
import { HookHalt, rehydrateError, tagError } from '../../helpers/engine-error.js';
import { runEngine } from './engine.js';
import { didDrainTimeOut, raceDrain } from '../../helpers/drain.js';
import { RunLog } from '../../run-log/index.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { checkGoal, checkMaxToolRounds, FILE_DELIVERED_NUDGE, GOAL_CONTINUATION_NUDGE, GOAL_ROUNDS, MAX_TOOL_ROUNDS, TOOL_CONTEXT_BOUNDARY_MESSAGE, TOOL_CONTINUATION_NUDGE, TOOL_CUT_OFF_MESSAGE, TOOL_DENIED_MESSAGE, TOOL_REPEATED_MESSAGE, TOOL_ROUND_CUT_MESSAGE, TOOL_UNCHANGED_MESSAGE } from '../tool-turns.js';
import { createSession } from './session.js';
import { captureFacts } from './durable.js';
import { completionPorts } from './ports.js';
import { detachJson } from '../../helpers/detach-json.js';
import { AbortedError } from '../../helpers/race-abort.js';
import { HarnessLog } from '../../log.js';
import { isRecord } from '../../guards.js';
import { removeRun } from '../../spill.js';
import { Agent } from '../../agent/index.js';
const completionLockOwner = {};
const IDENTITY_FIELDS = [
    'model',
    'messages',
    'agent',
    'cacheKey',
    'thinkingDefault',
    'generationParams',
    'responseFormat'
];
function requestValues(args) {
    return {
        model: args.model ?? args.modelId,
        messages: args.requestMessages ?? args.messages,
        agent: args.agent?.handoffs === null ? { ...args.agent, handoffs: undefined } : args.agent,
        cacheKey: args.cacheKey,
        thinkingDefault: args.thinkingDefault,
        generationParams: args.generationParams,
        responseFormat: args.responseFormat
    };
}
function digestKey(key, runId) {
    return createHmac('sha256', key).update(`qvac:completion:request:${runId}`).digest();
}
function hmac(key, domain, value) {
    return createHmac('sha256', key)
        .update(domain)
        .update('\0')
        .update(stableStringify(value))
        .digest('hex');
}
function keyProof(key, runId) {
    return createHmac('sha256', key).update(`qvac:completion:key-proof:${runId}`).digest('hex');
}
async function* submittedInput(input, pipeline, { runId, agentId }) {
    const iterator = input[Symbol.asyncIterator]();
    for (;;) {
        const next = await iterator.next();
        if (next.done) {
            return;
        }
        const item = next.value;
        let submitted;
        try {
            submitted = await pipeline.promptSubmit({ runId, agentId, mode: item.mode, text: item.text });
        }
        catch (error) {
            if (!(error instanceof HookHalt)) {
                throw error;
            }
            yield { reason: error.message };
            continue;
        }
        if (!submitted.ok) {
            yield { reason: submitted.rejection.error };
            continue;
        }
        yield submitted.context === undefined ? item : { ...item, notes: submitted.context };
    }
}
function hookManifest(hooks) {
    const ordinals = new Map();
    return hooks.map((hook) => {
        const ordinal = (ordinals.get(hook.phase) ?? 0) + 1;
        ordinals.set(hook.phase, ordinal);
        const descriptor = {
            phase: hook.phase,
            name: hook.name?.trim() || `${hook.phase}:${ordinal}`
        };
        if (hook.matcher !== undefined) {
            descriptor.matcher = hook.matcher;
        }
        if (hook.timeoutMs !== undefined) {
            descriptor.timeoutMs = hook.timeoutMs;
        }
        return descriptor;
    });
}
function initialRequest(args, options) {
    const { key, digestRunId, hooks } = options;
    const values = requestValues(args);
    const request = {};
    for (const field of IDENTITY_FIELDS) {
        if (values[field] !== undefined) {
            request[field] = detachJson(values[field]);
        }
    }
    if (key && digestRunId) {
        const scoped = digestKey(key, digestRunId);
        const proofs = {};
        request.identityVersion = 1;
        for (const field of IDENTITY_FIELDS) {
            if (values[field] !== undefined) {
                proofs[field] = hmac(scoped, `identity:${field}`, request[field]);
            }
        }
        request.identityProofs = proofs;
        request.toolConfigDigest = hmac(scoped, 'tool-config', canonicalToolConfig(args.toolConfigs));
        request.hookConfigDigest = hmac(scoped, 'hook-manifest', hookManifest(hooks));
        request.keyProof = keyProof(key, digestRunId);
    }
    return request;
}
function isCompletionMessages(value) {
    return (Array.isArray(value) &&
        value.every((message) => isRecord(message) &&
            typeof message.role === 'string' &&
            typeof message.content === 'string' &&
            (message.attachments === undefined ||
                (Array.isArray(message.attachments) &&
                    message.attachments.every((attachment) => isRecord(attachment) && typeof attachment.path === 'string')))));
}
function explicitIdentity(provided) {
    const values = requestValues(provided);
    const out = {};
    for (const field of IDENTITY_FIELDS) {
        if (values[field] !== undefined) {
            out[field] = detachJson(values[field]);
        }
    }
    return out;
}
function verifyResumeIdentity({ saved, metadata, key, provided, hooks }) {
    const digestRunId = metadata.digestRunId ?? metadata.runId;
    if (saved.identityVersion !== 1 ||
        typeof saved.keyProof !== 'string' ||
        saved.keyProof !== keyProof(key, digestRunId) ||
        typeof metadata.requestDigest !== 'string') {
        throw new Error('Resume requires the original durable request digest key');
    }
    const scoped = digestKey(key, digestRunId);
    if (typeof saved.hookConfigDigest !== 'string' ||
        saved.hookConfigDigest !== hmac(scoped, 'hook-manifest', hookManifest(hooks))) {
        throw new Error('Resume requires the original hook configuration');
    }
    const proofs = isRecord(saved.identityProofs) ? saved.identityProofs : undefined;
    const supplied = explicitIdentity(provided);
    for (const field of IDENTITY_FIELDS) {
        if (supplied[field] === undefined)
            continue;
        const expected = proofs?.[field];
        if (typeof expected !== 'string' ||
            expected !== hmac(scoped, `identity:${field}`, supplied[field])) {
            throw new Error('Resume cannot replace the original model, conversation, or execution configuration');
        }
    }
    if (provided.toolConfigs !== undefined) {
        if (!matchesToolConfig(saved, scoped, provided.toolConfigs)) {
            throw new Error('Resume requires the original tool configuration');
        }
    }
    else if (!matchesToolConfig(saved, scoped, {})) {
        throw new Error('Resume requires the original tool configuration');
    }
}
function resumedRequest({ boot, key, provided, hooks, bootRequest, runId }) {
    const metadata = boot?.metadata;
    if (!boot || !metadata) {
        throw new Error(`Run ${runId} does not exist`);
    }
    if (!(key instanceof Uint8Array) || key.byteLength !== 32) {
        throw new Error('Durable completion requires a 32-byte request digest key');
    }
    const stored = bootRequest ?? RunLog.requestFromBoot(boot);
    if (!isRequestIdentity(stored)) {
        throw new Error('Run boot has malformed original request metadata');
    }
    verifyResumeIdentity({ saved: stored, metadata, key, provided, hooks });
    if (typeof metadata.requestDigest !== 'string') {
        throw new Error('Run boot is missing its request digest');
    }
    return {
        identity: stored,
        metadata,
        key,
        args: argsFromRequest(stored),
        requestDigest: metadata.requestDigest,
        digestRunId: metadata.digestRunId ?? metadata.runId
    };
}
function isRequestIdentity(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (value.identityVersion !== undefined && value.identityVersion !== 1) {
        return false;
    }
    if (value.identityProofs !== undefined) {
        if (!isRecord(value.identityProofs)) {
            return false;
        }
        if (Object.values(value.identityProofs).some((proof) => typeof proof !== 'string')) {
            return false;
        }
    }
    return ((value.model === undefined || typeof value.model === 'string') &&
        (value.messages === undefined || isCompletionMessages(value.messages)) &&
        (value.agent === undefined || isAgent(value.agent)) &&
        (value.cacheKey === undefined || typeof value.cacheKey === 'string') &&
        (value.thinkingDefault === undefined || typeof value.thinkingDefault === 'string') &&
        (value.generationParams === undefined || isGenerationParams(value.generationParams)) &&
        (value.responseFormat === undefined || isResponseFormat(value.responseFormat)) &&
        (value.toolConfigDigest === undefined || typeof value.toolConfigDigest === 'string') &&
        (value.hookConfigDigest === undefined || typeof value.hookConfigDigest === 'string') &&
        (value.keyProof === undefined || typeof value.keyProof === 'string'));
}
function prepareRequest({ args, options, runId, resume, hooks }) {
    if (resume) {
        const resumed = resumedRequest({
            boot: options.boot,
            key: options.requestDigestKey,
            provided: options.resumeRequest ?? args,
            hooks,
            bootRequest: options.bootRequest,
            runId
        });
        return {
            identity: resumed.identity,
            requestDigest: resumed.requestDigest,
            savedArgs: resumed.args,
            resumed
        };
    }
    const identity = initialRequest(args, {
        key: options.requestDigestKey,
        digestRunId: runId,
        hooks
    });
    const key = options.requestDigestKey;
    const requestDigest = key ? hmac(digestKey(key, runId), 'request', identity) : undefined;
    return { identity, requestDigest, savedArgs: {}, resumed: undefined };
}
function matchesToolConfig(saved, scopedKey, value) {
    return (typeof saved.toolConfigDigest === 'string' &&
        saved.toolConfigDigest === hmac(scopedKey, 'tool-config', canonicalToolConfig(value)));
}
function canonicalToolConfig(value) {
    return value === undefined ? {} : detachJson(value);
}
function argsFromRequest(request) {
    return {
        model: typeof request.model === 'string' ? request.model : undefined,
        modelId: typeof request.model === 'string' ? request.model : undefined,
        messages: isCompletionMessages(request.messages) ? request.messages : undefined,
        agent: isAgent(request.agent) ? request.agent : undefined,
        cacheKey: typeof request.cacheKey === 'string' ? request.cacheKey : undefined,
        thinkingDefault: typeof request.thinkingDefault === 'string' ? request.thinkingDefault : undefined,
        generationParams: isGenerationParams(request.generationParams)
            ? request.generationParams
            : undefined,
        responseFormat: isResponseFormat(request.responseFormat) ? request.responseFormat : undefined
    };
}
function isAgent(value) {
    if (!isRecord(value))
        return false;
    const optionalString = (key) => value[key] === undefined || typeof value[key] === 'string';
    const optionalNullableString = (key) => value[key] === undefined || value[key] === null || typeof value[key] === 'string';
    const optionalStringArray = (key) => value[key] === undefined ||
        value[key] === null ||
        (Array.isArray(value[key]) && value[key].every((item) => typeof item === 'string'));
    const optionalNullableNumber = (key) => value[key] === undefined || value[key] === null || typeof value[key] === 'number';
    const optionalEnum = (key, values) => value[key] === undefined || value[key] === null || values.some((entry) => entry === value[key]);
    return (optionalString('id') &&
        optionalString('name') &&
        optionalString('bio') &&
        optionalStringArray('enabledTools') &&
        optionalStringArray('enabledSkills') &&
        optionalEnum('toolsScope', ['all', 'selected']) &&
        optionalEnum('skillsScope', ['all', 'selected']) &&
        optionalEnum('reasoning', ['inherit', 'enabled', 'disabled']) &&
        optionalNullableNumber('ctxSize') &&
        optionalNullableString('kvCacheK') &&
        optionalNullableString('kvCacheV') &&
        optionalNullableString('imageModelChoice') &&
        optionalNullableNumber('imageSteps') &&
        optionalNullableNumber('imageWidth') &&
        optionalNullableNumber('imageHeight') &&
        optionalEnum('approvalMode', ['ask', 'skip-all']) &&
        optionalStringArray('disabledToolsets') &&
        (value.policy === undefined || value.policy === null || isRecord(value.policy)) &&
        (value.plan === undefined || value.plan === null || typeof value.plan === 'boolean') &&
        optionalNullableString('model'));
}
function isGenerationParams(value) {
    return (isRecord(value) &&
        (value.reasoning_budget === undefined ||
            (Number.isInteger(value.reasoning_budget) && Number(value.reasoning_budget) >= -1)) &&
        (value.reasoning_rounds === undefined ||
            value.reasoning_rounds === 'every' ||
            value.reasoning_rounds === 'plan') &&
        [
            'temp',
            'top_p',
            'top_k',
            'presence_penalty',
            'repeat_penalty',
            'frequency_penalty',
            'predict',
            'seed'
        ].every((key) => value[key] === undefined || typeof value[key] === 'number'));
}
function isResponseFormat(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (value.type === 'text' || value.type === 'json_object') {
        return true;
    }
    if (value.type !== 'json_schema' || !isRecord(value.json_schema)) {
        return false;
    }
    return (typeof value.json_schema.name === 'string' &&
        isRecord(value.json_schema.schema) &&
        (value.json_schema.description === undefined ||
            typeof value.json_schema.description === 'string') &&
        (value.json_schema.strict === undefined || typeof value.json_schema.strict === 'boolean'));
}
function completionArgs(...parts) {
    const merged = {};
    for (const part of parts) {
        Object.assign(merged, part);
    }
    const own = merged.agent?.model ?? undefined;
    const modelId = own ?? (typeof merged.modelId === 'string' ? merged.modelId : merged.model);
    const messages = merged.messages;
    if (typeof modelId !== 'string' || !isCompletionMessages(messages)) {
        throw new Error('A completion requires its original model and messages');
    }
    return { ...merged, model: own ?? merged.model, modelId, messages };
}
function runPolicy({ maxToolRounds, goal, wording }) {
    return {
        maxToolRounds: checkMaxToolRounds(goal?.rounds ?? maxToolRounds ?? (goal ? GOAL_ROUNDS : MAX_TOOL_ROUNDS)),
        continuationNudge: wording?.toolContinuation ?? TOOL_CONTINUATION_NUDGE,
        deliveredNudge: wording?.fileDelivered ?? FILE_DELIVERED_NUDGE,
        deniedMessage: wording?.toolDenied ?? TOOL_DENIED_MESSAGE,
        cutOffMessage: wording?.toolCutOff ?? TOOL_CUT_OFF_MESSAGE,
        contextBoundaryMessage: wording?.toolContextBoundary ?? TOOL_CONTEXT_BOUNDARY_MESSAGE,
        roundCutMessage: wording?.toolRoundCut ?? TOOL_ROUND_CUT_MESSAGE,
        repeatedCallMessage: wording?.toolRepeated ?? TOOL_REPEATED_MESSAGE,
        unchangedMessage: wording?.toolUnchanged ?? TOOL_UNCHANGED_MESSAGE,
        failingMessage: wording?.toolFailing,
        goalNudge: wording?.goalContinuation ?? GOAL_CONTINUATION_NUDGE
    };
}
function restoredContextMetrics(boot) {
    const context = RunLog.contextFromBoot(boot);
    if (!isRecord(context) || !isRecord(context.metrics)) {
        return undefined;
    }
    const ctxSize = context.metrics.ctxSize;
    return typeof ctxSize === 'number' ? { ctxSize } : undefined;
}
function completionOutputFacts(value) {
    if (!isRecord(value) || !isRecord(value.outcome))
        return undefined;
    const confirmedWrites = readStringArray(value.outcome.confirmedWrites);
    const promptParts = readPromptUsage(value.promptParts);
    const backends = readBackends(value.backends);
    if (!confirmedWrites || promptParts === undefined || !backends) {
        return undefined;
    }
    return { confirmedWrites, promptParts, backends };
}
function readStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const strings = [];
    for (const entry of value) {
        if (typeof entry !== 'string')
            return undefined;
        strings.push(entry);
    }
    return strings;
}
function readPromptUsage(value) {
    if (value === null)
        return null;
    if (!isRecord(value))
        return undefined;
    const { systemPrompt, agentInstructions, activeSkills, toolSchemas } = value;
    if (typeof systemPrompt !== 'number' ||
        typeof agentInstructions !== 'number' ||
        typeof activeSkills !== 'number' ||
        typeof toolSchemas !== 'number') {
        return undefined;
    }
    return { systemPrompt, agentInstructions, activeSkills, toolSchemas };
}
function readBackends(value) {
    if (!Array.isArray(value))
        return undefined;
    const backends = [];
    for (const entry of value) {
        if (!isRunBackendUse(entry))
            return undefined;
        backends.push(entry);
    }
    return backends;
}
function isRunBackendUse(value) {
    return (isRecord(value) &&
        typeof value.tool === 'string' &&
        typeof value.requestedGpu === 'boolean' &&
        (value.device === 'gpu' || value.device === 'cpu' || value.device === 'unknown') &&
        typeof value.backend === 'string');
}
function detachedRequest(args) {
    const detached = { ...args };
    if (Array.isArray(args.messages)) {
        detached.messages = detachJson(args.messages);
    }
    if (Array.isArray(args.requestMessages)) {
        detached.requestMessages = detachJson(args.requestMessages);
    }
    if (args.agent) {
        detached.agent = detachJson(args.agent);
    }
    if (args.generationParams) {
        detached.generationParams = detachJson(args.generationParams);
    }
    if (args.responseFormat) {
        detached.responseFormat = detachJson(args.responseFormat);
    }
    if (args.toolConfigs) {
        detached.toolConfigs = detachJson(args.toolConfigs);
    }
    return detached;
}
function safeForkLength(boot) {
    return RunLog.safeForkLength(boot.receipts, new Map(boot.forkBeforeWrite), boot.unredactedLength);
}
function unresolvedWriteIds(boot) {
    const dispatched = RunLog.unresolvedWriteIds(boot.receipts);
    const queued = RunLog.unsettledRedactedIds(boot.redactedPendingIds, boot.receipts).filter((id) => !dispatched.includes(id));
    return [...dispatched, ...queued];
}
export async function* driveCompletion(args, runtime, options) {
    const { pipeline } = options;
    const hooks = pipeline.hooks;
    const resume = args.resume === true;
    if (resume && !args.runId) {
        throw new Error('Resume requires a runId');
    }
    const runId = args.runId ?? b4a.toHex(randomBytes(16));
    const boot = options.boot;
    const durable = typeof options.onStep === 'function';
    const key = options.requestDigestKey;
    if ((durable || boot) && (!(key instanceof Uint8Array) || key.byteLength !== 32)) {
        throw new Error('Durable completion requires a 32-byte request digest key');
    }
    const now = args.now ?? (() => Date.now());
    const wallStart = Date.now();
    const goal = args.goal && checkGoal(args.goal, args.responseFormat);
    const policy = runPolicy(args);
    const prepared = prepareRequest({ args, options, runId, resume, hooks });
    const completionState = {
        session: null,
        final: null
    };
    args.roundCut?.((note) => completionState.session?.liveRound?.cut?.(note));
    let full = detachedRequest(completionArgs(prepared.savedArgs, args));
    let reachedPause = false;
    const engine = runEngine({
        runId,
        parentRunId: args.parentRunId,
        resume,
        recovery: args.recovery,
        request: options.redact ? options.redact(prepared.identity) : prepared.identity,
        requestDigest: prepared.requestDigest,
        budget: boot?.metadata?.budget ?? createRunBudget(now(), goal?.ms ?? args.budgetMs),
        signal: args.signal,
        input: args.input && pipeline.hasPhase('promptSubmit')
            ? submittedInput(args.input, pipeline, { runId, agentId: full.agent?.id ?? null })
            : args.input,
        lockOwner: args.lockOwner ?? options.lockOwner ?? completionLockOwner,
        now,
        async start({ operations, invokes, boot: openedBoot }) {
            if (resume &&
                RunLog.unsettledRedactedIds(openedBoot.redactedPendingIds, openedBoot.receipts).length > 0) {
                const forkAt = safeForkLength(openedBoot);
                const recoveryOperationIds = unresolvedWriteIds(openedBoot);
                const forkSafe = forkAt !== null &&
                    !RunLog.forkRepeatsSettledWrite(openedBoot.receipts, new Map(openedBoot.forkBeforeWrite), forkAt);
                let message = 'This run cannot resume because pending tool arguments were redacted';
                if (forkSafe) {
                    message += `; fork at ${forkAt} to continue without them`;
                }
                else if (recoveryOperationIds.length > 0) {
                    message += `; ${RunLog.recoveryAdvice(recoveryOperationIds, openedBoot.receipts, openedBoot.redactedPendingIds)}`;
                }
                throw Object.assign(new Error(message), {
                    code: 'PENDING_ARGS_REDACTED',
                    forkAt,
                    forkSafe,
                    recoveryOperationIds
                });
            }
            if (typeof (full.model ?? full.modelId) !== 'string' ||
                !isCompletionMessages(full.messages)) {
                throw new Error('Completion resume requires its original model and messages');
            }
            const savedContext = restoredContextMetrics(openedBoot);
            if (resume) {
                full.ctxSize = savedContext?.ctxSize;
            }
            const loaded = await runtime(detachedRequest(full));
            full = detachedRequest(completionArgs(full, loaded.args ?? {}));
            if (prepared.resumed &&
                !matchesToolConfig(prepared.resumed.identity, digestKey(prepared.resumed.key, prepared.resumed.digestRunId), full.toolConfigs)) {
                throw new Error('Resume requires the original tool configuration');
            }
            const session = createSession(full, {
                runId,
                invokes,
                now,
                wallStart,
                requestDigestKey: prepared.resumed?.key ?? key,
                digestRunId: openedBoot.metadata?.digestRunId ??
                    openedBoot.metadata?.runId ??
                    prepared.resumed?.digestRunId ??
                    runId,
                pipeline,
                outbound: options.outbound,
                agentPorts: options.agentPorts
            });
            session.startedAt = openedBoot.metadata?.startedAt ?? openedBoot.firstSavedAt ?? now();
            if (openedBoot.metadata?.budget) {
                session.runBudget = { ...openedBoot.metadata.budget };
            }
            session.toolContext = runToolContext(full, session.runBudget);
            const context = CompletionMachine.emptyContext({
                policy,
                runId,
                agentId: full.agent?.id ?? null,
                ctxSize: full.ctxSize ?? savedContext?.ctxSize,
                cacheKey: full.cacheKey ?? null,
                planMode: full.planMode === true,
                plan: Agent.planFromMessages(full.messages),
                goal
            });
            context.durable = captureFacts(session);
            completionState.session = session;
            return {
                ports: completionPorts({
                    services: loaded.services,
                    sdk: loaded.sdk,
                    args: full,
                    session,
                    operations
                }),
                context
            };
        },
        settled(snapshot) {
            completionState.final = snapshot;
        }
    }, {
        boot,
        onStep: options.onStep,
        hostAppendTimeoutMs: options.hostAppendTimeoutMs,
        redact: options.redact,
        redactShared: options.redactShared,
        redactOperationResult: options.redactOperationResult,
        redactRecord: options.redactRecord,
        redactStep: options.redactStep,
        lockOwner: args.lockOwner ?? options.lockOwner ?? completionLockOwner,
        onDetached: options.onDetached
    });
    try {
        const result = yield* engine;
        if (result.status === 'replayed') {
            return;
        }
        const snapshot = result.snapshot;
        const facts = completionOutputFacts(snapshot.context.durable);
        const landed = facts?.confirmedWrites ?? [];
        const runMetrics = function* (cancelled = null) {
            const usage = facts?.promptParts
                ? usageBreakdown(facts.promptParts, snapshot.context.metrics.cacheTokens, full.model)
                : null;
            const { outcome } = snapshot.context;
            const metrics = metricsEvent({ ...snapshot.context.metrics, backends: facts?.backends }, Date.now() - wallStart, { usage, outcome: outcome === 'failed' ? null : outcome, cancelled });
            if (metrics) {
                yield { ...metrics, runId };
            }
        };
        if (result.status === 'error') {
            yield* reportLandedWrites(landed);
            if (result.error &&
                typeof result.error === 'object' &&
                'tag' in result.error &&
                result.error.tag === 'aborted') {
                reachedPause = true;
                yield* runMetrics(cancelledRound(completionState.session?.liveRound));
                throw new AbortedError();
            }
            throw rehydrateError(tagError(result.error));
        }
        if (result.status === 'paused') {
            yield* reportLandedWrites(landed);
            reachedPause = true;
            yield { type: 'paused', runId };
            return;
        }
        if (snapshot.output?.status === 'failure') {
            yield* reportLandedWrites(landed);
            throw rehydrateError(snapshot.context.failure, snapshot.output.error);
        }
        yield* runMetrics();
    }
    finally {
        const ended = completionState.final;
        const owner = completionState.session;
        if (!(durable && ended?.hasTag('paused'))) {
            await removeRun(runId);
        }
        if (!durable && owner?.runStarted && ended?.hasTag('paused')) {
            const runEnd = owner.pipeline.onRunEnd({
                runId,
                agentId: full.agent?.id ?? null,
                stats: {
                    totalTokens: ended.context.metrics.tokens,
                    durationMs: Date.now() - wallStart,
                    timeToFirstToken: ended.context.metrics.ttft
                },
                outcome: reachedPause ? 'aborted' : 'abandoned'
            });
            if (didDrainTimeOut(await raceDrain(runEnd))) {
                options.onDetached?.(runEnd, runId);
                HarnessLog.info('runEnd hook still running after completion closed', { runId });
            }
        }
    }
}
