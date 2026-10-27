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
import { getRequestRegistry, withRequestContext } from '../../../../runtime/request-context.js';
import { generateRandomRequestId } from '../../../../runtime/request-id.js';
import { InferenceCancelledError, InvalidResponseError } from '../../../../errors/index.js';
import { getEngineLogger } from '../../../../logging/index.js';
import { nowMs } from '../../../../profiling/index.js';
import { attachModelExecutionMs } from '../../../../profiling/model-execution.js';
import { decisionResultSchema } from '../../../../schemas/index.js';
import { transformDecisionRequest, transformDecisionResult } from '../helpers.js';
export async function decide(request) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const { modelId, requestId } = request;
        const nativeRequest = transformDecisionRequest(request);
        const ctx = __addDisposableResource(env_1, await getRequestRegistry().begin({
            requestId: requestId ?? generateRandomRequestId(),
            kind: 'decision',
            modelId
        }), true);
        const requestLogger = withRequestContext(getEngineLogger(), ctx);
        if (ctx.signal.aborted)
            throw new InferenceCancelledError(ctx.requestId);
        const model = getModel(modelId);
        let cancelPromise;
        const onAbort = () => {
            cancelPromise ??= model.cancel().catch((error) => {
                requestLogger.warn(`Laya cancel failed: ${error instanceof Error ? error.message : String(error)}`);
            });
        };
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        ctx.scope.defer(async () => {
            ctx.signal.removeEventListener('abort', onAbort);
            // A delayed native cancel must finish before the next job owns this model slot.
            await cancelPromise;
        });
        const started = nowMs();
        try {
            const response = await model.run(nativeRequest);
            const outputs = await response.await();
            if (ctx.signal.aborted)
                throw new InferenceCancelledError(ctx.requestId);
            if (outputs.length !== 1)
                throw new InvalidResponseError('decide');
            let result;
            try {
                const output = outputs[0];
                const converted = Array.isArray(output)
                    ? output.map(transformDecisionResult)
                    : transformDecisionResult(output);
                result = ('states' in nativeRequest ? decisionResultSchema.array() : decisionResultSchema).parse(converted);
            }
            catch (error) {
                throw new InvalidResponseError('decide', error);
            }
            if ('states' in nativeRequest &&
                (!Array.isArray(result) || result.length !== nativeRequest.states.length)) {
                throw new InvalidResponseError('decide');
            }
            return attachModelExecutionMs({ type: 'decide', result }, nowMs() - started);
        }
        catch (error) {
            if (ctx.signal.aborted)
                throw new InferenceCancelledError(ctx.requestId);
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
