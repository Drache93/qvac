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
import Buffer from 'bare-buffer';
import { getRequestRegistry, withRequestContext } from '../../../../runtime/index.js';
import { generateRandomRequestId } from '../../../../runtime/request-id.js';
import { getEngineLogger } from '../../../../logging/index.js';
import { InferenceCancelledError } from '../../../../errors/index.js';
export async function* diffusion(request) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const ctx = __addDisposableResource(env_1, await getRequestRegistry().begin({
            requestId: generateRandomRequestId(),
            kind: 'diffusion',
            modelId: request.modelId
        }), true);
        if (ctx.signal.aborted)
            throw new InferenceCancelledError(ctx.requestId);
        const model = getModel(request.modelId);
        const cancellable = model;
        const logger = withRequestContext(getEngineLogger(), ctx);
        let cancelPromise;
        const onAbort = () => {
            cancelPromise ??= cancellable.cancel().catch((error) => {
                logger.warn(`Diffusion cancel failed: ${String(error)}`);
            });
        };
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        ctx.scope.defer(async () => {
            ctx.signal.removeEventListener('abort', onAbort);
            // A delayed native cancel must finish before another request owns the model.
            await cancelPromise;
        });
        if (ctx.signal.aborted)
            throw new InferenceCancelledError(ctx.requestId);
        const init_image = request.init_image ? Buffer.from(request.init_image, 'base64') : undefined;
        const init_images = request.init_images
            ? request.init_images.map((b64) => Buffer.from(b64, 'base64'))
            : undefined;
        try {
            const response = await model.run({
                prompt: request.prompt,
                negative_prompt: request.negative_prompt,
                width: request.width,
                height: request.height,
                steps: request.steps,
                cfg_scale: request.cfg_scale,
                img_cfg_scale: request.img_cfg_scale ?? -1,
                guidance: request.guidance,
                sampling_method: request.sampling_method,
                scheduler: request.scheduler,
                seed: request.seed,
                batch_count: request.batch_count,
                vae_tiling: request.vae_tiling,
                cache_preset: request.cache_preset,
                init_image,
                init_images,
                increase_ref_index: request.increase_ref_index,
                auto_resize_ref_image: request.auto_resize_ref_image,
                strength: request.strength,
                lora: request.lora,
                upscale: request.upscale === false ? undefined : request.upscale
            });
            // Keep ownership until native work settles, including an early consumer exit.
            let drained = false;
            ctx.scope.defer(async () => {
                if (drained)
                    return;
                onAbort();
                try {
                    await response.await();
                }
                catch {
                    // The stream carries the original failure or cancellation.
                }
            });
            let outputIndex = 0;
            for await (const chunk of response.iterate()) {
                if (ctx.signal.aborted)
                    continue;
                if (chunk instanceof Uint8Array) {
                    yield {
                        type: 'diffusionStream',
                        data: Buffer.from(chunk).toString('base64'),
                        outputIndex: outputIndex++
                    };
                }
                else if (typeof chunk === 'string') {
                    try {
                        const tick = JSON.parse(chunk);
                        if ('step' in tick) {
                            yield {
                                type: 'diffusionStream',
                                step: tick['step'],
                                totalSteps: tick['total'],
                                elapsedMs: tick['elapsed_ms']
                            };
                        }
                    }
                    catch {
                        // Ignore non-JSON output.
                    }
                }
            }
            drained = true;
            if (ctx.signal.aborted)
                throw new InferenceCancelledError(ctx.requestId);
            const responseWithStats = response;
            return { stats: responseWithStats.stats ?? undefined };
        }
        catch (error) {
            if (ctx.signal.aborted) {
                if (error instanceof InferenceCancelledError)
                    throw error;
                throw new InferenceCancelledError(ctx.requestId, {}, error);
            }
            ctx.state = 'failed';
            throw error;
        }
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
