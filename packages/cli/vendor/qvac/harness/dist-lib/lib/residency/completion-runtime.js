import { HarnessError } from '../errors.js';
import { createLocalRoots } from '../tools/fs/local.js';
import { createRemoteRoots } from '../tools/fs/remote.js';
import { isResident, modelKey, resolveCtxSize } from '../models/model-pool.js';
import { HarnessLog } from '../log.js';
export async function prepareCompletionRuntime(residency, request) {
    const model = request.model ?? '';
    const agent = request.agent;
    const messages = request.messages ?? [];
    const { signal, grantedDirs, grantedDrives, driveOp } = request;
    const loadOpts = residency.loadOptions(model, agent);
    const projectionModel = loadOpts.projectionModel;
    if (request.resume && request.ctxSize) {
        loadOpts.ctxSize = request.ctxSize;
    }
    const key = modelKey(model, loadOpts);
    const resident = isResident(residency.pool, key);
    HarnessLog.info('completion start', { model, resident, projection: Boolean(projectionModel) });
    const acquireRound = roundAcquirer(residency, { model, key, loadOpts, signal });
    const remoteRoots = driveOp && grantedDrives?.length ? createRemoteRoots(grantedDrives, driveOp) : [];
    return {
        key,
        args: {
            acquireRound,
            ctxSize: await resolveCtxSize(() => residency.loadLifecycleSdk(), model, {
                opts: loadOpts,
                deviceConfig: residency.deviceConfig()
            }),
            messages: projectionModel ? messages : messages.map(({ attachments, ...turn }) => turn),
            requestMessages: messages,
            tools: withRunTools(residency.tools(), request.tools ?? []),
            skillCatalog: await residency.skills(agent?.id ?? null, model),
            fsRoots: [
                ...(grantedDirs?.length ? await createLocalRoots(grantedDirs) : []),
                ...remoteRoots
            ],
            fsWriteRoots: [
                ...(request.grantedWriteDirs?.length
                    ? await createLocalRoots(request.grantedWriteDirs)
                    : []),
                ...remoteRoots.filter((root) => root.writable)
            ]
        }
    };
}
export function roundAcquirer(residency, { model, key, loadOpts, signal }) {
    return async (invocationSignal) => {
        const pool = residency.pool;
        const lease = await residency.acquireLease({
            pool,
            key,
            open: () => pool.open(key, model, loadOpts),
            signal: invocationSignal,
            prepare: async () => {
                if (!isResident(pool, key)) {
                    await residency.makeRoomForCompletion(model, {
                        loadOpts,
                        signal: invocationSignal ?? signal
                    });
                    await residency.unloadIdleGenerators();
                }
                return true;
            }
        });
        if (!lease) {
            throw new Error('A completion round requires a model lease');
        }
        try {
            const sdk = await residency.sdk.load();
            if (residency.gate.suspended || residency.gate.draining) {
                throw new HarnessError('HARNESS_SUSPENDED');
            }
            residency.gate.assertNotClosing();
            return {
                modelId: lease.modelId,
                ctxSize: lease.ctxSize,
                slots: lease.slots,
                sdk,
                release: lease.release
            };
        }
        catch (error) {
            lease.release();
            throw error;
        }
    };
}
function withRunTools(builtIn, own) {
    const names = new Set(own.map((tool) => tool.name));
    return [...builtIn.filter((tool) => !names.has(tool.name)), ...own];
}
