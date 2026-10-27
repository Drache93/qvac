import fs from 'bare-fs';
import { ModelType } from '../../schemas/index.js';
import { getPlugin } from '../../plugins/registry.js';
import { getRuntimeContext } from '../../runtime/state.js';
import { formatZodError } from '../../utils/zod-error.js';
import { getModelByPath } from '../../models/registry/index.js';
import { fetchFitStub, fetchFitStubSet, removeStub } from './fetch.js';
function srcString(modelSrc) {
    return typeof modelSrc === 'string' ? modelSrc : modelSrc.src;
}
/**
 * The stub ref a source carries, or `undefined` where it names no registry
 * artifact. A catalog constant carries the checksum and coordinates; a bare
 * string names a location and nothing the registry can be asked about.
 */
function stubRefFor(modelSrc) {
    if (typeof modelSrc === 'string')
        return undefined;
    const { sha256Checksum, registryPath, registrySource } = modelSrc;
    if (sha256Checksum === undefined || registryPath === undefined)
        return undefined;
    return {
        name: modelSrc.name ?? modelSrc.modelId ?? registryPath,
        sha256Checksum,
        registryPath,
        ...(registrySource !== undefined && { registrySource })
    };
}
function stubSetFor(registryPath) {
    const companionSet = getModelByPath(registryPath)?.companionSet;
    if (companionSet === undefined)
        return undefined;
    let primary;
    const others = [];
    for (const file of companionSet.files) {
        const member = {
            name: file.targetName,
            sha256Checksum: file.sha256Checksum,
            registryPath: file.registryPath,
            registrySource: file.registrySource,
            targetName: file.targetName
        };
        if (file.key === companionSet.primaryKey)
            primary = member;
        else
            others.push(member);
    }
    return primary === undefined ? undefined : { primary, others };
}
/**
 * Engines whose fitter sizes the files on disk and reads no registry
 * description, so a stub would be answered for as if it were the model.
 */
const FILES_ONLY_ENGINES = new Set([ModelType.nmtcppTranslation]);
class NoStubError extends Error {
    reason;
    constructor(reason, message) {
        super(message ?? reason);
        this.reason = reason;
    }
}
/**
 * Resolves a load the way `loadModel` would, against the registry's weightless
 * descriptions instead of the weights.
 *
 * The plugin's own `resolveConfig` does the work: it strips the source fields
 * from the config and returns the artifact paths keyed the way its engine
 * expects. Only what a source resolves to differs here, so the config and the
 * keys are the real load's.
 *
 * A source already on disk is read directly, since it describes the load more
 * exactly than a stub does. A files-only engine reads only sources on disk.
 */
export async function resolveLoadFromStubs(load, options = {}) {
    const plugin = getPlugin(load.modelType);
    if (!plugin) {
        return { status: 'unsupported-load', detail: `no plugin registered for ${load.modelType}` };
    }
    const parsed = plugin.loadConfigSchema.safeParse(load.modelConfig ?? {});
    if (!parsed.success) {
        return { status: 'unsupported-load', detail: formatZodError(parsed.error) };
    }
    const modelConfig = parsed.data;
    const staged = [];
    const release = async () => {
        for (const path of staged)
            await removeStub(path);
    };
    const resolveModelPath = async (src) => {
        const location = srcString(src);
        if (location !== '' && fs.existsSync(location))
            return location;
        if (FILES_ONLY_ENGINES.has(load.modelType))
            throw new NoStubError('files-only-engine');
        const ref = stubRefFor(src);
        if (ref === undefined)
            throw new NoStubError('unresolvable-ref', location);
        const set = stubSetFor(ref.registryPath);
        const stub = set === undefined ? await fetchFitStub(ref, options) : await fetchFitStubSet(set, options);
        if (stub.status !== 'ready')
            throw new NoStubError(stub.reason, stub.message);
        staged.push(stub.path);
        return stub.path;
    };
    try {
        const modelPath = load.modelSrc === undefined ? '' : await resolveModelPath(load.modelSrc);
        if (plugin.resolveConfig === undefined) {
            return {
                status: 'resolved',
                modelPath,
                modelConfig,
                artifacts: {},
                release
            };
        }
        const context = {
            resolveModelPath,
            modelSrc: load.modelSrc === undefined ? '' : srcString(load.modelSrc),
            modelType: load.modelType,
            ...(getRuntimeContext().platform !== undefined && {
                platform: getRuntimeContext().platform
            })
        };
        const resolved = await plugin.resolveConfig(modelConfig, context);
        return {
            status: 'resolved',
            modelPath,
            modelConfig: resolved.config,
            artifacts: (resolved.artifacts ?? {}),
            release
        };
    }
    catch (error) {
        await release();
        if (error instanceof NoStubError) {
            return error.message === error.reason
                ? { status: 'no-stub', reason: error.reason }
                : { status: 'no-stub', reason: error.reason, message: error.message };
        }
        // A config the plugin refuses describes a load that would not start either.
        return {
            status: 'unsupported-load',
            detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        };
    }
}
