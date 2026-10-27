import { normalizeModelType, PROFILING_KEY, createErrorResponse, requestSchema } from './schemas/index.js';
import { z } from 'zod';
import { formatZodError } from './utils/zod-error.js';
import os from 'bare-os';
import { PassThrough } from 'bare-stream';
import { registry } from './registry.js';
import { handlerSupportsProgress, selectHandler } from './selection.js';
import { assertLifecycleAllowed } from './runtime/runtime-lifecycle.js';
import { resolveModelConfig, setConfig, setRuntimeContext, isConfigSet } from './runtime/state.js';
import { initialize, close as closeEngine } from './runtime/lifecycle.js';
import { getAllPlugins } from './plugins/index.js';
import { hasRpcServerProvider } from './rpc/provider.js';
import { resolveConfig } from './config/resolve-config.js';
import { setGlobalLogLevel, setGlobalConsoleOutput, getAppLogger } from './logging/index.js';
import { profileReplyHandler, profileStreamHandler } from './profiling/index.js';
import { RPCNoHandlerError, PluginsNotRegisteredError, RequestValidationFailedError } from './errors/index.js';
// The dispatch seam. Public operations in `api/` build a typed request and call
// `send`/`stream`/`duplex`; this runs each against the handler registry.
// A thrown handler error propagates as its real typed instance, so consumers can
// `instanceof`-check it directly.
const logger = getAppLogger();
let ready = false;
let readyPromise = null;
// The current init generation. `close()` bumps it so an init still in flight
// does not mark readiness.
let generation = 0;
function ensurePluginsRegistered() {
    if (getAllPlugins().length === 0 && !hasRpcServerProvider()) {
        throw new PluginsNotRegisteredError();
    }
}
function applyLoggerSettings(config) {
    if (config.loggerLevel !== undefined)
        setGlobalLogLevel(config.loggerLevel);
    if (config.loggerConsoleOutput !== undefined) {
        setGlobalConsoleOutput(config.loggerConsoleOutput);
    }
}
async function initializeConfig() {
    // A host may have injected config already. Only resolve from disk when it hasn't
    // — a second `setConfig` would throw `ConfigAlreadySetError`.
    if (!isConfigSet()) {
        const config = await resolveConfig();
        if (config) {
            applyLoggerSettings(config);
            setConfig(config);
            logger.info('📦 Initializing QVAC config');
        }
    }
    // First-write-wins: an injected runtime context is preserved; this bare default
    // only applies to standalone Bare, where nothing was injected.
    const runtimeContext = {
        runtime: 'bare',
        platform: os.platform()
    };
    setRuntimeContext(runtimeContext);
}
async function performReady(gen) {
    initialize();
    await initializeConfig();
    // Mark ready only while this generation is current — a `close()` during the
    // await bumps it past this now-superseded init.
    if (gen === generation)
        ready = true;
}
async function ensureReady(allowWithoutPlugins = false) {
    if (!allowWithoutPlugins)
        ensurePluginsRegistered();
    if (ready)
        return;
    // A single shared promise serializes concurrent first calls: `ready` only
    // flips after `initializeConfig` awaits, so overlapping callers must run
    // `setConfig` exactly once — a second run throws `ConfigAlreadySetError`.
    // Cleared on failure so a later call can retry (e.g. after plugins register),
    // unless a newer generation already replaced this promise.
    if (!readyPromise) {
        const gen = generation;
        readyPromise = performReady(gen).catch((error) => {
            if (gen === generation)
                readyPromise = null;
            throw error;
        });
    }
    await readyPromise;
}
function getHandlerEntry(type) {
    const entry = registry[type];
    if (!entry)
        throw new RPCNoHandlerError(type);
    return entry;
}
/**
 * Fills a request that describes a load with device and schema config
 * defaults before the handler runs, matching the priority user config >
 * device defaults > schema defaults.
 *
 * `loadModel` and every `assessModelFit` candidate describe the same load, so
 * both are filled the same way: the fitter is asked about the settings a real
 * load resolves, and refuses one carrying no `device` at all. Every other
 * request type passes through untouched.
 */
function applyDeviceDefaults(request) {
    if (request.type === 'assessModelFit' && 'models' in request) {
        return applyCandidateDeviceDefaults(request);
    }
    if (request.type !== 'loadModel' || !('modelSrc' in request))
        return request;
    let canonicalType;
    try {
        canonicalType = normalizeModelType(request.modelType);
    }
    catch {
        return request;
    }
    const rawConfig = request.modelConfig ?? {};
    return { ...request, modelConfig: resolveModelConfig(canonicalType, rawConfig) };
}
function applyCandidateDeviceDefaults(request) {
    const models = request.models;
    if (models === undefined)
        return request;
    return {
        ...request,
        models: models.map((load) => {
            let canonicalType;
            try {
                canonicalType = normalizeModelType(load.modelType);
            }
            catch {
                return load;
            }
            const rawConfig = load.modelConfig ?? {};
            return { ...load, modelConfig: resolveModelConfig(canonicalType, rawConfig) };
        })
    };
}
function getProfilingMeta(request) {
    if (PROFILING_KEY in request) {
        return request[PROFILING_KEY];
    }
    return undefined;
}
/**
 * Validate a request against its schema and apply device + schema defaults
 * before dispatch. Every operation flows through here, so validation and
 * defaulting are guaranteed for the whole registry — there is no per-operation
 * step to forget. Per-call profiling meta rides on a symbol key the schema
 * parse would drop, so it is carried across.
 */
function prepareRequest(request) {
    let withDeviceDefaults;
    let validated;
    try {
        // Resolving device defaults parses the model config, so a bad value fails here.
        withDeviceDefaults = applyDeviceDefaults(request);
        validated = requestSchema.parse(withDeviceDefaults);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new RequestValidationFailedError(formatZodError(error));
        }
        throw error;
    }
    const profilingMeta = getProfilingMeta(withDeviceDefaults);
    if (profilingMeta !== undefined) {
        ;
        validated[PROFILING_KEY] = profilingMeta;
    }
    return validated;
}
function invokeHandler(request, handler) {
    const directHandler = handler;
    return directHandler(request);
}
function invokeStreamHandler(request, entry, handler, context) {
    if (!entry.endsOnAbort)
        return invokeHandler(request, handler);
    return handler(request, context);
}
function isAsyncGenerator(result) {
    return typeof result === 'object' && result !== null && Symbol.asyncIterator in result;
}
/**
 * Bridge a progress-callback handler (which returns a single final response and
 * pushes interim updates through a callback) into an async generator.
 */
async function* streamWithProgress(request, handler) {
    const queue = [];
    const errors = [];
    let done = false;
    function progressCallback(update) {
        queue.push(update);
    }
    const directHandler = handler;
    Promise.resolve(directHandler(request, progressCallback))
        .then((final) => {
        queue.push(final);
        done = true;
    })
        .catch((error) => {
        errors.push(error);
        done = true;
    });
    while (!done || queue.length > 0) {
        if (queue.length > 0) {
            yield queue.shift();
        }
        else {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
    const handlerError = errors[0];
    if (handlerError)
        throw handlerError;
}
export async function send(request, _options) {
    await ensureReady(request.type === 'startRpcServer' ||
        request.type === 'stopRpcServer' ||
        request.type === 'discoverRpcServers' ||
        (request.type === 'cancel' && request.operation === 'request'));
    assertLifecycleAllowed(request);
    const processed = prepareRequest(request);
    const entry = getHandlerEntry(processed.type);
    const handler = selectHandler(entry);
    // Plugin capabilities profile themselves inside plugin dispatch. Everything
    // else is timed here so the `profiler` covers every operation. Profiling is a
    // no-op unless enabled.
    if (entry.pluginOp) {
        return (await invokeHandler(processed, handler));
    }
    return profileReplyHandler({ op: processed.type, request: processed }, () => invokeHandler(processed, handler));
}
/** `options.signal` ends the stream only for a handler with `endsOnAbort`. */
export async function* stream(request, options) {
    await ensureReady();
    assertLifecycleAllowed(request);
    const processed = prepareRequest(request);
    const entry = getHandlerEntry(processed.type);
    const handler = selectHandler(entry);
    const signal = entry.endsOnAbort ? options?.signal : undefined;
    if (signal?.aborted)
        return;
    const context = signal ? { signal } : {};
    async function* run() {
        if (handlerSupportsProgress(entry, processed)) {
            yield* streamWithProgress(processed, handler);
            return;
        }
        const result = invokeStreamHandler(processed, entry, handler, context);
        if (isAsyncGenerator(result)) {
            yield* result;
        }
        else {
            yield await result;
        }
    }
    // See `send`: plugin capabilities are timed elsewhere.
    if (entry.pluginOp) {
        yield* run();
    }
    else {
        yield* profileStreamHandler({ op: processed.type, request: processed }, run);
    }
}
export async function duplex(request, _options) {
    await ensureReady();
    assertLifecycleAllowed(request);
    const processed = prepareRequest(request);
    const entry = registry[processed.type];
    if (!entry || entry.type !== 'duplex') {
        throw new RPCNoHandlerError(processed.type);
    }
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    const duplexHandler = entry.handler;
    void (async () => {
        try {
            for await (const response of duplexHandler(processed, inputStream)) {
                outputStream.write(JSON.stringify(response) + '\n', 'utf-8');
            }
        }
        catch (error) {
            inputStream.destroy();
            outputStream.write(JSON.stringify(createErrorResponse(error)) + '\n', 'utf-8');
        }
        finally {
            outputStream.end();
        }
    })();
    return {
        requestStream: inputStream,
        responseStream: outputStream
    };
}
export async function close() {
    // Bump the generation so an in-flight `performReady` does not mark readiness;
    // the next send re-initializes.
    generation++;
    ready = false;
    readyPromise = null;
    await closeEngine();
}
