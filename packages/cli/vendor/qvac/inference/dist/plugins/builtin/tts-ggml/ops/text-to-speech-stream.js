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
import { getModel } from '../../../../runtime/model-registry.js';
import { textToSpeechStreamRequestSchema } from '../../../../schemas/index.js';
import Buffer from 'bare-buffer';
import { nowMs } from '../../../../profiling/index.js';
import { buildStreamResult, hasDefinedValues } from '../../../../profiling/model-execution.js';
import { TextToSpeechStreamFailedError } from '../../../../errors/index.js';
import { collectTtsStats, chunkMetadata } from '../../../../utils/tts-stats.js';
import { assertParlerJobOptionsSupported, getParlerJobOptions, getTtsEngineType } from './parler-options.js';
import { bindTtsCancel, cancelIfAborted } from './cancel-binding.js';
// Ends the text source the moment the run is cancelled. Without this an idle
// duplex session — cancelled while the accumulator is waiting for the next
// fragment, with no native job live — would sit in `runStreaming` holding the
// model's slot until the client wrote more text, and then synthesise it.
async function* untilAborted(source, signal) {
    const iterator = source[Symbol.asyncIterator]();
    const aborted = new Promise((resolve) => {
        const end = () => resolve({ done: true, value: undefined });
        if (signal.aborted)
            end();
        else
            signal.addEventListener('abort', end, { once: true });
    });
    try {
        while (true) {
            const next = await Promise.race([iterator.next(), aborted]);
            if (next.done)
                return;
            yield next.value;
        }
    }
    finally {
        const returned = iterator.return?.();
        if (returned !== undefined) {
            // When the abort won the race above, the `iterator.next()` it raced is
            // still pending — the client is idle inside `for await (const buf of
            // inputStream)`. An async generator queues `return()` behind that
            // outstanding `next()`, so awaiting here would not settle until the
            // client sends more text or closes the stream, which is exactly what an
            // idle cancel cannot count on. Blocking would keep this generator alive,
            // so `runStreaming`'s text source would never end, the op would never
            // return, and the model's single concurrency slot would stay held. Let
            // the cleanup settle on its own in that case, and keep awaiting it on
            // the ordinary paths, where no `next()` is outstanding.
            if (signal.aborted)
                void Promise.resolve(returned).catch(() => { });
            else
                await returned;
        }
    }
}
function hasRunStreaming(model) {
    return (typeof model === 'object' &&
        model !== null &&
        'runStreaming' in model &&
        typeof model.runStreaming === 'function');
}
function findLastCompleteUtf8End(buf) {
    const len = buf.length;
    for (let i = len - 1; i >= 0 && i >= len - 3; i--) {
        const b = buf[i];
        if ((b & 0x80) === 0) {
            return i + 1;
        }
        if ((b & 0xc0) === 0xc0) {
            let expected;
            if ((b & 0xe0) === 0xc0)
                expected = 2;
            else if ((b & 0xf0) === 0xe0)
                expected = 3;
            else if ((b & 0xf8) === 0xf0)
                expected = 4;
            else
                return len;
            return i + expected <= len ? len : i;
        }
    }
    return len;
}
async function* buffersToUtf8Fragments(inputStream) {
    let pending = Buffer.alloc(0);
    for await (const buf of inputStream) {
        const combined = pending.length === 0 ? buf : Buffer.concat([pending, buf]);
        const completeEnd = findLastCompleteUtf8End(combined);
        if (completeEnd > 0) {
            const s = combined.subarray(0, completeEnd).toString('utf8');
            if (s.length > 0) {
                yield s;
            }
        }
        pending =
            completeEnd < combined.length ? Buffer.from(combined.subarray(completeEnd)) : Buffer.alloc(0);
    }
    if (pending.length > 0) {
        const s = pending.toString('utf8');
        if (s.length > 0) {
            yield s;
        }
    }
}
function buildRunStreamingOptions(request, parlerJobOptions) {
    const o = {};
    if (request.accumulateSentences !== undefined) {
        o['accumulateSentences'] = request.accumulateSentences;
    }
    if (request.sentenceDelimiterPreset !== undefined) {
        o['sentenceDelimiterPreset'] = request.sentenceDelimiterPreset;
    }
    if (request.maxBufferScalars !== undefined) {
        o['maxBufferScalars'] = request.maxBufferScalars;
    }
    if (request.flushAfterMs !== undefined) {
        o['flushAfterMs'] = request.flushAfterMs;
    }
    return { ...o, ...parlerJobOptions };
}
export async function* textToSpeechStream(params, inputStream) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const request = textToSpeechStreamRequestSchema.parse(params);
        const model = getModel(request.modelId);
        if (['moss-sfx', 'moss-speech'].includes(getTtsEngineType(model) ?? '')) {
            throw new TextToSpeechStreamFailedError('MOSS-SoundEffect and MOSS-Speech are batch-only');
        }
        const parlerJobOptions = getParlerJobOptions(request);
        assertParlerJobOptionsSupported(model, parlerJobOptions, 'textToSpeechStream');
        const ctx = __addDisposableResource(env_1, await bindTtsCancel(model, request.modelId, request.requestId), true);
        if (ctx.signal.aborted)
            return { ...buildStreamResult(0), cancelled: true };
        const modelStart = nowMs();
        if (!hasRunStreaming(model)) {
            throw new TextToSpeechStreamFailedError('textToSpeechStream requires a TTS model with runStreaming');
        }
        const textSource = untilAborted(buffersToUtf8Fragments(inputStream), ctx.signal);
        const streamOpts = buildRunStreamingOptions(request, parlerJobOptions);
        const response = await model.runStreaming(textSource, Object.keys(streamOpts).length > 0 ? streamOpts : undefined);
        try {
            for await (const data of response.iterate()) {
                if (await cancelIfAborted(model, ctx.signal))
                    continue;
                // lunte-disable-next-line eqeqeq -- `== null` intentionally matches null and undefined
                if (data.outputArray == null) {
                    continue;
                }
                const buf = Array.from(data.outputArray);
                if (buf.length === 0) {
                    continue;
                }
                yield { buffer: buf, ...chunkMetadata(data) };
            }
        }
        catch (error) {
            // The addon fails the response with its own 'Job cancelled' error once a
            // cancel lands on a live job; after an abort that is the expected exit.
            if (!ctx.signal.aborted)
                throw error;
        }
        const stats = collectTtsStats(response);
        return {
            ...buildStreamResult(nowMs() - modelStart, hasDefinedValues(stats) ? stats : undefined),
            ...(ctx.signal.aborted ? { cancelled: true } : {})
        };
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
