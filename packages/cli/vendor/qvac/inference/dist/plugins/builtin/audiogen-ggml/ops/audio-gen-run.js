var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { AudioGen, audiogenBackendName, audiogenGpuFallbackReason } from '@qvac/audiogen-ggml';
import { z } from 'zod';
import { audioGenStatsSchema } from '../../../../schemas/audio-gen.js';
import { graphicsDriverSchema } from '../../../../schemas/index.js';
import { getEngineLogger } from '../../../../logging/index.js';
import { attachBackendDiagnostics } from '../../../../profiling/backend-diagnostics.js';
import { getModel } from '../../../../runtime/model-registry.js';
import { getRequestRegistry, withRequestContext } from '../../../../runtime/index.js';
import { generateRequestId } from '../../../../runtime/request-id.js';
import { ModelOperationNotSupportedError } from '../../../../errors/index.js';
/**
 * Runs one AudioGen job under the request registry and streams it as
 * `TType` frames: progress ticks, PCM chunks, then the terminal frame with
 * stats and backend diagnostics. Owns admission (`kind: 'audiogen'`, one
 * active job per model), abort-to-cancel wiring, and the cancelled terminal.
 */
export async function* streamAudioGenRun(options) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const { type, request } = options;
        const ctx = __addDisposableResource(env_1, await getRequestRegistry().begin({
            requestId: request.requestId ?? generateRequestId(),
            kind: 'audiogen',
            modelId: request.modelId
        }), true);
        const logger = withRequestContext(getEngineLogger(), ctx);
        const candidate = getModel(request.modelId);
        if (!(candidate instanceof AudioGen)) {
            throw new ModelOperationNotSupportedError(request.modelId, 'audiogen-ggml', type, [], []);
        }
        const model = candidate;
        // A queued request can resume from begin() already aborted. It never owned
        // the model slot, so calling the model-scoped cancel here would interrupt
        // the earlier same-model generation that still owns it.
        if (ctx.signal.aborted) {
            yield { type, done: true, stopReason: 'cancelled' };
            return;
        }
        let cancelPromise;
        const onAbort = () => {
            cancelPromise ??= model.cancel().catch((error) => {
                logger.warn(`[cancel] model.cancel() rejected during abort for modelId=${request.modelId}: ${error instanceof Error ? error.message : String(error)}`);
            });
        };
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        if (ctx.signal.aborted)
            onAbort();
        ctx.scope.defer(async () => {
            ctx.signal.removeEventListener('abort', onAbort);
            await cancelPromise;
        });
        let response;
        let streamedUnderstand;
        try {
            response = await options.start(model, ctx, logger);
            if (response !== undefined) {
                for await (const chunk of response.iterate()) {
                    if (ctx.signal.aborted)
                        break;
                    if ('progress' in chunk) {
                        yield { type, progress: chunk.progress, done: false };
                        continue;
                    }
                    // `understand()` reports a description instead of audio; generation
                    // and editing never produce this item.
                    if ('understand' in chunk) {
                        // The engine repeats this result on the terminal stats, so the
                        // converted form is kept rather than rebuilt from the raw codes.
                        streamedUnderstand = toUnderstandResult(chunk.understand);
                        yield {
                            type,
                            understand: streamedUnderstand,
                            done: false
                        };
                        continue;
                    }
                    if (!('outputArray' in chunk))
                        continue;
                    const pcm = new Uint8Array(chunk.outputArray.buffer, chunk.outputArray.byteOffset, chunk.outputArray.byteLength);
                    yield {
                        type,
                        data: Buffer.from(pcm).toString('base64'),
                        sampleRate: chunk.sampleRate,
                        channels: chunk.channels,
                        bitsPerSample: Int16Array.BYTES_PER_ELEMENT * 8,
                        done: false
                    };
                }
            }
        }
        catch (error) {
            if (!ctx.signal.aborted)
                throw error;
        }
        if (ctx.signal.aborted || response === undefined) {
            yield { type, done: true, stopReason: 'cancelled' };
            return;
        }
        const raw = await response.await();
        // `understand.audioCodes` arrives as an Int32Array, which the wire schema —
        // and anything downstream of JSON — needs as a plain array of integers.
        // Both parses below read the normalized object: handing the raw one to
        // either schema fails its `z.array` check on the typed array.
        const normalized = raw.understand
            ? { ...raw, understand: streamedUnderstand ?? toUnderstandResult(raw.understand) }
            : raw;
        const stats = audioGenStatsSchema.parse(normalized);
        const diagnostics = buildBackendDiagnostics(audiogenStats.parse(normalized));
        const terminal = {
            type,
            done: true,
            stopReason: 'completed',
            stats,
            ...(diagnostics && { diagnostics })
        };
        yield diagnostics ? attachBackendDiagnostics(terminal, diagnostics) : terminal;
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        const result_1 = __disposeResources(env_1);
        if (result_1)
            await result_1;
    }
}
// The addon reports gpuFallbackReason, which the wire shape deliberately does
// not carry: it reaches callers named, on diagnostics.fallback.reason.
const audiogenStats = audioGenStatsSchema.extend({
    gpuFallbackReason: z.number().optional()
});
/**
 * Normalizes the addon's understand result for the wire: `audioCodes` arrives
 * as an `Int32Array`, which neither the schema nor a JSON transport accepts.
 */
function toUnderstandResult(result) {
    return { ...result, audioCodes: Array.from(result.audioCodes) };
}
/** An unrecognized GPU id yields no diagnostics rather than a guessed backend name. */
function buildBackendDiagnostics(stats) {
    if (stats.backendDevice === undefined)
        return undefined;
    if (stats.backendDevice !== 1) {
        const fallback = gpuFallbackDetail(stats);
        return { selectedBackend: 'cpu', selectedDevice: 'cpu', ...(fallback && { fallback }) };
    }
    // A 'cpu' name against backendDevice 1 is the addon contradicting itself.
    const selectedBackend = audiogenBackendName(stats.backendId);
    if (selectedBackend === undefined || selectedBackend === 'cpu')
        return undefined;
    const graphicsApi = graphicsDriverSchema.safeParse(selectedBackend);
    return {
        selectedBackend,
        selectedDevice: 'gpu',
        ...(graphicsApi.success && { graphicsApi: graphicsApi.data })
    };
}
// `none` and `not-requested` describe a run that never lost a GPU, and an
// unmapped code must not become a guessed reason.
function gpuFallbackDetail(stats) {
    const reason = audiogenGpuFallbackReason(stats.gpuFallbackReason);
    if (reason === undefined || reason === 'none' || reason === 'not-requested')
        return undefined;
    return { requestedDevice: 'gpu', reason };
}
