import fs, { promises as fsPromises } from 'bare-fs';
import path from 'bare-path';
import { AbortController } from 'bare-abort-controller';
import { getCacheDir } from '../../utils/cache/paths.js';
import { calculateFileChecksum } from '../../utils/checksum.js';
import { getEngineLogger } from '../../logging/index.js';
/**
 * Bounds the registry lookup and the blob fetch together. The client's own
 * defaults — 30s per attempt, three attempts, a peer wait between them, and an
 * uncapped wait for the registry view on first use — suit a weights download.
 * Here an unreachable registry is the whole latency of the call, so it is
 * capped. Work still in flight at expiry is abandoned: the download is
 * aborted, and a lookup that cannot be cancelled settles on its own with
 * nothing waiting for it.
 *
 * One budget covers a whole companion set, so it holds the slowest case: every
 * member of a multi-stage voice model staged over a mobile network. It sits
 * above the client's per-attempt timeout rather than on it, so an attempt that
 * is about to answer is not cut at the moment it would have.
 */
export const FIT_STUB_BUDGET_MS = 40_000;
async function defaultGetEntry(registryPath, registrySource) {
    const { getRegistryClient } = await import('../../runtime/registry-client.js');
    const client = await getRegistryClient();
    return client.getModel(registryPath, registrySource);
}
async function defaultDownloadBlob(binding, outputFile, signal) {
    const { getRegistryClient } = await import('../../runtime/registry-client.js');
    const client = await getRegistryClient();
    return client.downloadBlob(binding, {
        outputFile,
        maxRetries: 1,
        ...(signal !== undefined && { signal })
    });
}
/** Removes a fetched stub and the directory it was staged in. Never throws. */
export async function removeStub(stubPath) {
    await fsPromises.rm(path.dirname(stubPath), { recursive: true, force: true }).catch(() => { });
}
function unavailable(reason, message) {
    return message === undefined
        ? { status: 'unavailable', reason }
        : { status: 'unavailable', reason, message };
}
function describe(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
/**
 * Fetches the fit stub for one artifact into its own staging directory and
 * returns its path. The stub is a per-call payload, not a cache: the caller
 * removes it once the fitter has read it, so nothing accumulates under the
 * QVAC root and no cleanup path has to know about it.
 *
 * Never throws: a missing entry, an entry without a description, a failed or
 * corrupt download and an expired budget are all `unavailable`, because a
 * pre-download assessment has to survive an offline caller and an older
 * registry record.
 *
 * Only the artifact named by `ref` is fetched. A split model's shards each
 * carry their own binding, and the fitter needs the whole set laid out under
 * llama's shard naming to read any of it — assembling that is not done here.
 */
export async function fetchFitStub(ref, options = {}) {
    return withinBudget(ref.name, options, (signal) => fetchWithin(ref, options, signal));
}
/**
 * Stages a companion set under its target names in one directory, the layout a
 * downloaded set has, for engines that find their companions beside the
 * checkpoint. The primary decides the outcome; a member the registry holds no
 * description for is skipped.
 */
export async function fetchFitStubSet(set, options = {}) {
    return withinBudget(set.primary.name, options, (signal) => fetchSetWithin(set, options, signal));
}
function withinBudget(name, options, work) {
    const budgetMs = options.budgetMs ?? FIT_STUB_BUDGET_MS;
    const controller = new AbortController();
    const onAbort = () => controller.abort(new Error('fit stub fetch aborted by the caller'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    let timer;
    const expiry = new Promise((resolve) => {
        timer = setTimeout(() => {
            controller.abort(new Error('fit stub budget expired'));
            resolve(unavailable('timed-out', `no fit stub for ${name} from the registry within ${budgetMs}ms`));
        }, budgetMs);
    });
    return Promise.race([work(controller.signal), expiry]).finally(() => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
    });
}
// One directory per fetch, so two assessments of the same model never share a
// file that one of them is about to remove.
async function makeStagingDir(options) {
    const root = options.cacheDir ?? getCacheDir('fit-stubs');
    await fsPromises.mkdir(root, { recursive: true });
    // On Windows `mkdtemp` returns the `\\?\` namespaced form of the path, and
    // an engine that derives a companion's path by appending `/<name>` to it
    // (bci's colocated embedder) then names a file that does not resolve.
    // Keep the root as given and take only the generated directory name.
    const created = await fsPromises.mkdtemp(path.join(root, 'stub-'));
    return path.join(root, path.basename(created));
}
async function bindingFor(ref, options) {
    const { registryPath, registrySource } = ref;
    if (!registryPath || !registrySource)
        return 'unresolvable-ref';
    const getEntry = options.getEntry ?? defaultGetEntry;
    const entry = await getEntry(registryPath, registrySource);
    if (entry === null || entry === undefined)
        return 'not-in-registry';
    const binding = entry.fitBlobBinding;
    if (binding === undefined || binding === null)
        return 'no-fit-blob';
    return binding;
}
async function stageOne(ref, binding, dest, options, signal) {
    const downloadBlob = options.downloadBlob ?? defaultDownloadBlob;
    let verified = false;
    try {
        await downloadBlob(binding, dest, signal);
        const bytes = fs.statSync(dest).size;
        if (bytes !== binding.byteLength) {
            return unavailable('download-failed', `fit stub for ${ref.name} is ${bytes} bytes, the record says ${binding.byteLength}`);
        }
        // The record binds the description by digest; a stub that reads back
        // differently is not the description the fitter should answer for.
        const digest = await calculateFileChecksum(dest);
        if (digest.toLowerCase() !== binding.sha256.toLowerCase()) {
            return unavailable('download-failed', `fit stub for ${ref.name} hashes to ${digest}, the record says ${binding.sha256}`);
        }
        // Past the budget nobody is waiting for this result, so the stub must
        // not be marked as kept.
        if (signal.aborted)
            return unavailable('timed-out');
        verified = true;
        return { status: 'staged', bytes };
    }
    catch (error) {
        return unavailable('download-failed', describe(error));
    }
    finally {
        // A short, corrupt, half-written or late stub must not outlive the call.
        if (!verified)
            await fsPromises.rm(dest, { force: true }).catch(() => { });
    }
}
async function fetchWithin(ref, options, signal) {
    const logger = options.logger ?? getEngineLogger();
    try {
        const binding = await bindingFor(ref, options);
        if (typeof binding === 'string')
            return unavailable(binding);
        if (signal.aborted)
            return unavailable('timed-out');
        const dir = await makeStagingDir(options);
        const dest = path.join(dir, `${binding.sha256}.gguf`);
        const staged = await stageOne(ref, binding, dest, options, signal);
        if (staged.status !== 'staged') {
            await removeStub(dest);
            return staged;
        }
        return { status: 'ready', path: dest, bytes: staged.bytes };
    }
    catch (error) {
        logger.debug(`fit stub for ${ref.name} unavailable: ${describe(error)}`);
        return unavailable('download-failed', describe(error));
    }
}
async function fetchSetWithin(set, options, signal) {
    const logger = options.logger ?? getEngineLogger();
    let dir;
    let ready = false;
    try {
        const binding = await bindingFor(set.primary, options);
        if (typeof binding === 'string')
            return unavailable(binding);
        if (signal.aborted)
            return unavailable('timed-out');
        dir = await makeStagingDir(options);
        const dest = path.join(dir, set.primary.targetName);
        const staged = await stageOne(set.primary, binding, dest, options, signal);
        if (staged.status !== 'staged')
            return staged;
        for (const member of set.others) {
            if (signal.aborted)
                break;
            const memberBinding = await bindingFor(member, options);
            if (typeof memberBinding === 'string') {
                logger.debug(`companion ${member.targetName} has no fit stub: ${memberBinding}`);
                continue;
            }
            const memberDest = path.join(dir, member.targetName);
            const memberStaged = await stageOne(member, memberBinding, memberDest, options, signal);
            if (memberStaged.status !== 'staged') {
                logger.debug(`companion ${member.targetName} was not staged`);
            }
        }
        // The budget races this work and has already answered the caller once it
        // expires, so a set finished after that point is staged for nobody.
        // The budget answers the caller on its own, so a set finished after it
        // expired is staged for nobody.
        if (signal.aborted)
            return unavailable('timed-out');
        ready = true;
        return { status: 'ready', path: dest, bytes: staged.bytes };
    }
    catch (error) {
        logger.debug(`fit stub set for ${set.primary.name} unavailable: ${describe(error)}`);
        return unavailable('download-failed', describe(error));
    }
    finally {
        if (!ready && dir !== undefined) {
            await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => { });
        }
    }
}
