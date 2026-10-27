import { logCacheDisabled, logCacheSave, logMessagesToAddon } from './cache-logger.js';
import { extractSystemPrompt, getCurrentCacheInfo } from '../../../ops/kv-cache-utils.js';
import { getModel, getModelConfig } from '../../../../runtime/model-registry.js';
import { shouldCommitCachedTurn } from './kv-cache-state.js';
import { createKvCacheSession, generateConfigHash } from './kv-cache-session.js';
import { detectToolDialect, prependToolsToHistory } from '../../../../utils/tool-integration.js';
import { resolveDeferredTools, toWireTool } from '../../../../utils/tools/defer.js';
import { parseToolCalls } from '../../../../utils/tools/index.js';
import { getResponseFormatJsonSchema } from '../../../../utils/response-format.js';
import { buildAutoCacheSaveHistory, normalizeCacheMessage } from '../../../../utils/index.js';
import { getEngineLogger } from '../../../../logging/index.js';
import { AttachmentNotFoundError } from '../../../../errors/index.js';
import { nowMs } from '../../../../profiling/index.js';
import { buildStreamResult } from '../../../../profiling/model-execution.js';
import { normalizeCompletionStats, withEmittedTokens } from './completion-stats.js';
import fs from 'bare-fs';
const logger = getEngineLogger();
export function withParallelToolCalls(generationParams) {
    return {
        ...generationParams,
        parallel_tool_calls: generationParams?.parallel_tool_calls ?? true
    };
}
function transformMessage(message) {
    const transformed = [];
    // Check if it's a tool definition (has type: "function")
    if ('type' in message && message.type === 'function') {
        transformed.push({
            type: 'function',
            name: message.name,
            description: message.description,
            parameters: message.parameters
        });
        return transformed;
    }
    const msg = message;
    if (msg.attachments && msg.attachments.length > 0) {
        for (const attachment of msg.attachments) {
            if (!fs.existsSync(attachment.path)) {
                throw new AttachmentNotFoundError(attachment.path);
            }
            transformed.push({
                role: msg.role,
                content: attachment.path,
                type: 'media'
            });
        }
    }
    transformed.push({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCalls && {
            tool_calls: msg.toolCalls.map((call) => ({
                ...(call.id !== undefined && { id: call.id }),
                name: call.name,
                arguments: call.arguments
            }))
        }),
        ...(msg.toolCallId !== undefined && { tool_call_id: msg.toolCallId }),
        ...(msg.toolName !== undefined && { name: msg.toolName })
    });
    return transformed;
}
function runModel(model, prompt, opts) {
    return model.run(prompt, opts);
}
export function transformMessages(messages) {
    const transformed = [];
    for (const message of messages) {
        transformed.push(...transformMessage(message));
    }
    return transformed;
}
// The fields that identify a turn, so two tool turns with equal `content`
// never share a cache key.
function toCacheMessage(msg) {
    return {
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments ?? undefined,
        ...(msg.toolCalls && { toolCalls: msg.toolCalls }),
        ...(msg.toolCallId !== undefined && { toolCallId: msg.toolCallId }),
        ...(msg.toolName !== undefined && { toolName: msg.toolName })
    };
}
/**
 * Put the model's configured system prompt in front of a history that carries
 * none. `transform.ts` strips `system_prompt` from the config handed to the
 * addon, so the conversation is the only way it reaches the model.
 */
export function seedConfiguredSystemPrompt(history, modelConfig) {
    const configured = modelConfig.system_prompt;
    if (!configured || extractSystemPrompt(history) !== null)
        return history;
    // Every caller's message type makes everything past role and content optional.
    return [{ role: 'system', content: configured }, ...history];
}
// The addon refuses to save a key it holds nothing for — a cold turn it rolled
// back — with `InvalidArgument`. As with its other status errors, an
// asynchronous rejection carries the message alone.
function isNothingCachedRejection(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    const code = error.code;
    if (code !== undefined) {
        return typeof code === 'string' && /^\[\s*[\w.-]+\s*::\s*InvalidArgument\s*\]$/.test(code);
    }
    const message = error.message;
    return typeof message === 'string' && /no conversation is cached/.test(message);
}
/**
 * Write the conversation the addon holds for `cachePath` to that file. The
 * session commits on the file, and a saved conversation is one the addon drops
 * once `deleteCache` removes the file. A cold turn the addon rolled back has
 * nothing to write, and the commit then finds no file. Any other rejection is
 * a write that failed: the file is behind the conversation, which the next
 * turn re-decodes.
 */
async function saveCacheFile(model, cachePath, log) {
    const saveCache = model.saveCache;
    if (!saveCache) {
        log.debug(`[kv-cache] model has no saveCache; nothing written for ${cachePath}`);
        return;
    }
    try {
        await saveCache.call(model, cachePath);
        logCacheSave(cachePath);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (isNothingCachedRejection(error)) {
            log.debug(`[kv-cache] saveCache had nothing to write for ${cachePath}: ${detail}`);
            return;
        }
        log.warn(`[kv-cache] saveCache failed; the file is behind the conversation and the next turn re-decodes what it lacks. path=${cachePath} error=${detail}`);
    }
}
async function* processModelResponse(model, messagesToSend, tools, generationParams, cacheOptions, dialect, onResponse) {
    const runOptions = {
        ...(generationParams && { generationParams }),
        ...(cacheOptions?.cacheKey !== undefined && {
            cacheKey: cacheOptions.cacheKey
        }),
        ...(cacheOptions?.prefill !== undefined && {
            prefill: cacheOptions.prefill
        })
    };
    const hasRunOptions = Object.keys(runOptions).length > 0;
    const modelStart = nowMs();
    const response = await runModel(model, messagesToSend, hasRunOptions ? runOptions : undefined);
    // Hand the admitted response back so the caller can cancel just this job.
    onResponse?.(response);
    let accumulatedText = '';
    let producedTokens = false;
    let emittedPieces = 0;
    let toolCallsResult = [];
    for await (const token of response.iterate()) {
        const tokenStr = token;
        if (tokenStr.length > 0) {
            producedTokens = true;
            emittedPieces++;
        }
        accumulatedText += tokenStr;
        yield { token: tokenStr };
    }
    const modelExecutionMs = nowMs() - modelStart;
    if (tools && tools.length > 0) {
        const { toolCalls } = parseToolCalls(accumulatedText, tools, dialect);
        toolCallsResult = toolCalls;
    }
    const responseWithStats = response;
    const stats = withEmittedTokens(normalizeCompletionStats(responseWithStats.stats), emittedPieces);
    const stopReason = responseWithStats.stats?.stopReason;
    return {
        ...buildStreamResult(modelExecutionMs, stats),
        toolCalls: toolCallsResult,
        responseText: accumulatedText,
        producedTokens,
        stoppedAtContextBoundary: stopReason === 'contextOverflow'
    };
}
export async function* completion(params, opts) {
    const { history: requestHistory, modelId, kvCache, prefill, tools, generationParams, responseFormat } = params;
    const { signal, scope } = opts;
    const requestLogger = opts.logger ?? logger;
    const modelConfig = getModelConfig(modelId);
    const history = seedConfiguredSystemPrompt(requestHistory, modelConfig);
    const toolsEnabled = modelConfig.tools === true;
    // With deferred tools the prompt carries the always-loaded ones, `tool_search`
    // and its catalog, and whatever earlier searches loaded. `null` when nothing
    // defers, which leaves the existing path alone.
    const deferred = resolveDeferredTools(tools, history);
    const toolsToRender = deferred?.toolsToRender ?? tools?.map(toWireTool);
    const toolsActive = !!toolsToRender?.length && toolsEnabled;
    const dialect = tools && tools.length > 0 ? (params.toolDialect ?? detectToolDialect(modelId)) : undefined;
    // `responseFormat` is forwarded to the addon as a per-request
    // `generationParams.json_schema`, which the addon converts to GBNF and
    // applies for the duration of the request only. This avoids mutating
    // the shared `modelConfig` and is therefore safe under concurrent
    // completions on the same model. `tools` still constrain output through
    // their parameter schema and the dialect-specific parser chain (mutually
    // exclusive with a non-text `responseFormat` at the schema layer).
    let mergedGenerationParams = generationParams;
    if (responseFormat && !(tools && tools.length > 0)) {
        const jsonSchema = getResponseFormatJsonSchema(responseFormat);
        if (jsonSchema !== undefined) {
            mergedGenerationParams = {
                ...(generationParams ?? {}),
                json_schema: jsonSchema
            };
        }
    }
    mergedGenerationParams = withParallelToolCalls(mergedGenerationParams);
    const model = getModel(modelId);
    // Per-request hard cancel: under continuous batching the model runs several
    // jobs at once, so an abort must cancel only THIS request's job, not the
    // whole model — `response.cancel()` routes to the addon's per-job cancel.
    // `.catch(...)` keeps the fire-and-forget cancel from leaking a rejection.
    let activeResponse = null;
    const cancelActive = () => {
        activeResponse?.cancel().catch((err) => {
            requestLogger.warn(`[cancel] response.cancel() rejected during abort for modelId=${modelId}: ${err instanceof Error ? err.message : String(err)}`);
        });
    };
    // Publish each run's response as it's admitted; the `signal.aborted` re-check
    // cancels it if the abort landed while run() was still being admitted.
    const setActiveResponse = (response) => {
        activeResponse = response;
        if (signal.aborted)
            cancelActive();
    };
    const onAbort = () => cancelActive();
    signal.addEventListener('abort', onAbort, { once: true });
    // `{ once: true }` won't fire for an already-aborted signal (e.g. an
    // already-aborted parentSignal at begin), so fire once here; a no-op before
    // any response exists.
    if (signal.aborted)
        onAbort();
    scope.defer(() => {
        signal.removeEventListener('abort', onAbort);
        // Drop the ref so a late abort can't cancel an already-settled response.
        activeResponse = null;
    });
    // The cached and uncached paths send the same prompt: the whole conversation
    // and the tools, every turn. With a cache key the addon keeps the longest
    // prefix it already holds and decodes only the rest.
    const prompt = transformMessages(toolsActive && toolsToRender ? prependToolsToHistory(history, toolsToRender) : history);
    if (!kvCache) {
        logCacheDisabled();
        logMessagesToAddon(prompt, 'NO_CACHE');
        return yield* processModelResponse(model, prompt, toolsToRender, mergedGenerationParams, undefined, dialect, setActiveResponse);
    }
    // ---- KV-cache path. The session owns every bookkeeping layer; the handler
    // registers one deferred unwind that `commitTurn` short-circuits. The addon
    // leaves the file consistent whatever the outcome — it commits or rolls back
    // the request itself — so the unwind keeps it (`releaseTurn`) except where
    // the file has no key to live under. A rollback also drops the addon's copy
    // of the conversation, which a later key switch or unload would otherwise
    // write back to the deleted path. ----
    const discardCache = model.discardCache;
    const session = createKvCacheSession(modelId, {
        logger: requestLogger,
        ...(discardCache && {
            discardCache: (cachePath) => discardCache.call(model, cachePath)
        })
    });
    const configHash = generateConfigHash(extractSystemPrompt(history));
    let turn;
    if (typeof kvCache === 'string') {
        turn = await session.beginTurn({
            kind: 'custom',
            customKey: kvCache,
            configHash,
            signal
        });
    }
    else {
        const cacheMessages = history.map(toCacheMessage);
        turn = await session.beginTurn({
            kind: 'auto',
            configHash,
            history: prefill ? cacheMessages.map(normalizeCacheMessage) : cacheMessages,
            ...(toolsActive && toolsToRender ? { tools: toolsToRender } : {}),
            signal
        });
    }
    // Scope unwinding is LIFO — registered after the `removeEventListener`
    // defer above so this runs before the listener detach.
    let rollbackOnUnwind = false;
    scope.defer(() => (rollbackOnUnwind ? session.rollback(turn) : session.releaseTurn(turn)));
    logMessagesToAddon(prompt, 'PROMPT_SEND');
    const result = yield* processModelResponse(model, prompt, toolsToRender, mergedGenerationParams, { cacheKey: turn.cachePath, ...(prefill !== undefined && { prefill }) }, dialect, setActiveResponse);
    if (typeof kvCache === 'string') {
        // Custom-key path: the file holds whatever the addon kept, cancelled and
        // stopped turns included.
        await saveCacheFile(model, turn.cachePath, requestLogger);
        await session.commitTurn(turn, { kind: 'static' });
        return result;
    }
    // Auto-cache path.
    if (prefill && !signal.aborted && !result.stoppedAtContextBoundary) {
        await saveCacheFile(model, turn.cachePath, requestLogger);
        const cacheInfo = await getCurrentCacheInfo(modelId, configHash, history.map(toCacheMessage).map(normalizeCacheMessage), toolsActive ? toolsToRender : undefined);
        await session.commitTurn(turn, 
        // Renaming to the held path would reacquire its non-reentrant write lock.
        cacheInfo.cachePath === turn.cachePath
            ? { kind: 'static' }
            : { kind: 'autoRename', targetCachePath: cacheInfo.cachePath });
        return result;
    }
    // Tool-call turns: the auto-cache key is derived from
    // `result.responseText`, which here is raw tool-call markup rather
    // than a clean assistant message. There's no safe post-response key
    // to rename to, so the deferred rollback drops the turn, unwritten. Once
    // we support auto-cache for structured assistant/tool turns,
    // this becomes a normal commit path.
    if (result.toolCalls.length > 0) {
        logger.warn(`[kv-cache] Auto cache tool-call turn; rolling back to avoid disk leak. path=${turn.cachePath}`);
        rollbackOnUnwind = true;
        return result;
    }
    const shouldRename = shouldCommitCachedTurn({
        aborted: signal.aborted,
        producedTokens: result.producedTokens,
        generatedTokens: result.stats?.generatedTokens,
        predict: mergedGenerationParams?.predict ?? modelConfig.predict,
        stoppedAtContextBoundary: result.stoppedAtContextBoundary
    });
    if (!shouldRename) {
        // A cancelled, empty or cut-off reply is not one the caller will send
        // back as-is, so there is no post-response key to move to. The file stays
        // under the history it was found by, holding what the addon kept. A first
        // turn found no file, and one it wrote now would only be rolled back.
        if (!turn.createdCache)
            await saveCacheFile(model, turn.cachePath, requestLogger);
        return result;
    }
    await saveCacheFile(model, turn.cachePath, requestLogger);
    const savedHistory = buildAutoCacheSaveHistory(history.map(toCacheMessage), result.responseText);
    const postResponseCacheInfo = await getCurrentCacheInfo(modelId, configHash, savedHistory, toolsActive ? toolsToRender : undefined);
    await session.commitTurn(turn, {
        kind: 'autoRename',
        targetCachePath: postResponseCacheInfo.cachePath
    });
    return result;
}
