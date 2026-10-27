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
import { getMossJobOptions } from './moss-options.js';
import { getModel } from '../../../../runtime/model-registry.js';
import { ttsRequestSchema } from '../../../../schemas/index.js';
import { nowMs } from '../../../../profiling/index.js';
import { buildStreamResult, hasDefinedValues } from '../../../../profiling/model-execution.js';
import { PluginRequestValidationFailedError, TextToSpeechFailedError } from '../../../../errors/index.js';
import { appendPcm, collectTtsStats, chunkMetadata } from '../../../../utils/tts-stats.js';
import { assertParlerJobOptionsSupported, getParlerJobOptions, getTtsEngineType } from './parler-options.js';
import { bindTtsCancel, cancelIfAborted } from './cancel-binding.js';
function hasRunStream(model) {
    return (typeof model === 'object' &&
        model !== null &&
        'runStream' in model &&
        typeof model.runStream === 'function');
}
function finish(modelStart, response, cancelled) {
    const stats = collectTtsStats(response);
    return {
        ...buildStreamResult(nowMs() - modelStart, hasDefinedValues(stats) ? stats : undefined),
        ...(cancelled ? { cancelled: true } : {})
    };
}
// The addon fails the response with its own 'Job cancelled' error once a
// cancel lands on a live job. After an abort that is the expected way out,
// not a failure to surface.
function rethrowUnlessCancelled(error, signal) {
    if (!signal.aborted)
        throw error;
}
export async function* textToSpeech(params) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const request = ttsRequestSchema.parse(params);
        const { modelId, text = '', stream, sentenceStream, sentenceStreamLocale, sentenceStreamMaxChunkScalars } = request;
        const parlerJobOptions = getParlerJobOptions(request);
        const model = getModel(modelId);
        const mossJobOptions = getMossJobOptions(model, request);
        assertParlerJobOptionsSupported(model, parlerJobOptions, 'textToSpeech');
        // MOSS streams natively: one job over the whole text, emitting a chunk every
        // `streamChunkTokens` codec frames while the backbone is still generating.
        // The sentence chunker behind `streamOutput` would restart the prompt per
        // sentence, which a MOSS-TTSD dialogue cannot do (every job has to open
        // with the reference transcripts, so the addon rejects it) and which would
        // apply `durationTokens` to each sentence rather than to the text.
        // `sentenceStream: true` still asks for the chunker explicitly.
        const nativeStream = stream && !sentenceStream && getTtsEngineType(model) === 'moss';
        // The chunker is what reads these, so on the native path they would be
        // dropped without a trace.
        if (nativeStream &&
            (sentenceStreamLocale !== undefined || sentenceStreamMaxChunkScalars !== undefined)) {
            throw new PluginRequestValidationFailedError('textToSpeech', 'sentenceStreamLocale and sentenceStreamMaxChunkScalars need the sentence chunker; MOSS streams the whole text natively, so they only apply with sentenceStream: true');
        }
        const ctx = __addDisposableResource(env_1, await bindTtsCancel(model, modelId, request.requestId), true);
        if (ctx.signal.aborted)
            return { ...buildStreamResult(0), cancelled: true };
        const modelStart = nowMs();
        if (sentenceStream) {
            if (!hasRunStream(model)) {
                throw new TextToSpeechFailedError('sentenceStream requires a TTS model with runStream');
            }
            const streamOpts = sentenceStreamLocale !== undefined ||
                sentenceStreamMaxChunkScalars !== undefined ||
                Object.keys(parlerJobOptions).length > 0
                ? {
                    ...(sentenceStreamLocale !== undefined ? { locale: sentenceStreamLocale } : {}),
                    ...(sentenceStreamMaxChunkScalars !== undefined
                        ? { maxChunkScalars: sentenceStreamMaxChunkScalars }
                        : {}),
                    ...parlerJobOptions
                }
                : undefined;
            const response = await model.runStream(text, streamOpts);
            if (!stream) {
                const completeBuffer = [];
                let sampleRate;
                try {
                    for await (const data of response.iterate()) {
                        if (await cancelIfAborted(model, ctx.signal))
                            continue;
                        // lunte-disable-next-line eqeqeq -- `!= null` intentionally matches null and undefined
                        if (data.outputArray != null) {
                            sampleRate ??= data.sampleRate;
                            appendPcm(completeBuffer, data.outputArray);
                        }
                    }
                }
                catch (error) {
                    rethrowUnlessCancelled(error, ctx.signal);
                }
                // A cancelled collect must not hand back a partial buffer as if complete.
                if (ctx.signal.aborted)
                    return finish(modelStart, response, true);
                yield { buffer: completeBuffer, ...(sampleRate !== undefined ? { sampleRate } : {}) };
                return finish(modelStart, response, false);
            }
            try {
                for await (const data of response.iterate()) {
                    if (await cancelIfAborted(model, ctx.signal))
                        continue;
                    // lunte-disable-next-line eqeqeq -- `== null` intentionally matches null and undefined
                    if (data.outputArray == null)
                        continue;
                    const buf = Array.from(data.outputArray);
                    if (buf.length === 0)
                        continue;
                    yield { buffer: buf, ...chunkMetadata(data) };
                }
            }
            catch (error) {
                rethrowUnlessCancelled(error, ctx.signal);
            }
            return finish(modelStart, response, ctx.signal.aborted);
        }
        const engine = getTtsEngineType(model);
        const batchEngine = engine === 'moss-sfx' || engine === 'moss-speech';
        const sentenceChunked = stream && !nativeStream && !batchEngine;
        const response = (await model.run({
            input: text,
            // The addon's job field is `type`, and its native layer accepts only
            // 'text' (AddonJs.hpp runJob) — the addon's own streaming paths hard-code
            // it. Pin it here too, so the request's `inputType` (which the schema
            // does not constrain) behaves the same on every path.
            type: 'text',
            ...(sentenceChunked ? { streamOutput: true } : {}),
            // `run({ streamOutput: true })` runs the same chunker as `runStream()`, so
            // the chunking knobs apply here too — they used to be honoured only on the
            // sentenceStream path.
            ...(sentenceChunked && sentenceStreamLocale !== undefined
                ? { locale: sentenceStreamLocale }
                : {}),
            ...(sentenceChunked && sentenceStreamMaxChunkScalars !== undefined
                ? { maxChunkScalars: sentenceStreamMaxChunkScalars }
                : {}),
            ...parlerJobOptions,
            ...mossJobOptions
        }));
        if (!stream || batchEngine) {
            const completeBuffer = [];
            let sampleRate;
            let replyText;
            try {
                for await (const data of response.iterate()) {
                    if (await cancelIfAborted(model, ctx.signal))
                        continue;
                    sampleRate ??= data.sampleRate;
                    if (data.text !== undefined)
                        replyText = data.text;
                    appendPcm(completeBuffer, data.outputArray);
                }
            }
            catch (error) {
                rethrowUnlessCancelled(error, ctx.signal);
            }
            if (ctx.signal.aborted)
                return finish(modelStart, response, true);
            yield {
                buffer: completeBuffer,
                ...(sampleRate !== undefined ? { sampleRate } : {}),
                ...(replyText !== undefined ? { text: replyText } : {})
            };
            return finish(modelStart, response, false);
        }
        try {
            for await (const data of response.iterate()) {
                if (await cancelIfAborted(model, ctx.signal))
                    continue;
                yield { buffer: Array.from(data.outputArray), ...chunkMetadata(data) };
            }
        }
        catch (error) {
            rethrowUnlessCancelled(error, ctx.signal);
        }
        return finish(modelStart, response, ctx.signal.aborted);
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
