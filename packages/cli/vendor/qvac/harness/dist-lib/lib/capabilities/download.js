import { Readable } from 'streamx';
import { errorMessage } from '../guards.js';
import { resolveModelSrc } from '../models/model-source.js';
const noop = () => { };
export function download(sdkOrLoader, args, onSettled, onDrained) {
    const { model, addon = 'llm', seed, signal, projection, companions = [], assetSizes } = args;
    const loadSdk = typeof sdkOrLoader === 'function' ? sdkOrLoader : () => Promise.resolve(sdkOrLoader);
    let transferred = false;
    let settled = false;
    let opDone = false;
    let cancelSent = false;
    let sdkRef = null;
    let requestId;
    const finish = (event) => {
        if (settled)
            return;
        settled = true;
        stream.push(event);
        stream.push(null);
        onSettled?.(event);
    };
    const cancelOp = () => {
        if (cancelSent || opDone || !requestId || !sdkRef?.cancel)
            return;
        cancelSent = true;
        sdkRef.cancel({ requestId }).catch(noop);
    };
    const onAbort = () => {
        cancelOp();
        finish({ type: 'aborted' });
    };
    const onProgress = (p) => {
        if (!settled) {
            stream.push({ ...p, type: 'progress', transferred });
        }
    };
    const start = async () => {
        if (signal?.aborted) {
            finish({ type: 'aborted' });
            onDrained?.();
            return;
        }
        try {
            sdkRef = await loadSdk();
            const resolved = await resolveModelSrc(sdkRef, model, addon);
            const mainSrc = typeof resolved === 'string' ? resolved : resolved.src;
            const srcs = Array.from(new Set([mainSrc, ...(projection ? [projection] : []), ...companions]));
            const aggregate = aggregateLayout(srcs, assetSizes);
            let mainAssetId = '';
            for (let i = 0; i < srcs.length; i++) {
                if (signal?.aborted) {
                    return finish({ type: 'aborted' });
                }
                const progress = aggregate
                    ? aggregateProgressHandler(onProgress, {
                        setKey: mainSrc,
                        currentFile: srcs[i],
                        fileIndex: i,
                        totalFiles: srcs.length,
                        offset: aggregate.offsets[i],
                        expectedSize: aggregate.sizes[i],
                        totalBytes: aggregate.totalBytes
                    })
                    : onProgress;
                const op = sdkRef.downloadAsset({
                    assetSrc: srcs[i],
                    seed,
                    onProgress: (update) => {
                        if (update.percentage < 100) {
                            transferred = true;
                        }
                        progress(update);
                    }
                });
                requestId = op.requestId;
                const assetId = await op;
                if (i === 0) {
                    mainAssetId = assetId;
                }
            }
            opDone = true;
            finish({ type: 'complete', assetId: mainAssetId, downloaded: transferred });
        }
        catch (err) {
            opDone = true;
            if (signal?.aborted) {
                return finish({ type: 'aborted' });
            }
            finish({ type: 'error', message: errorMessage(err) });
        }
        finally {
            onDrained?.();
        }
    };
    const stream = new Readable({
        open(cb) {
            signal?.addEventListener?.('abort', onAbort, { once: true });
            void start();
            cb(null);
        },
        destroy(cb) {
            signal?.removeEventListener?.('abort', onAbort);
            cancelOp();
            cb(null);
        }
    });
    return stream;
}
function aggregateLayout(sources, assetSizes) {
    if (!assetSizes)
        return null;
    const offsets = [];
    const sizes = [];
    let totalBytes = 0;
    for (const source of sources) {
        const size = assetSizes[source];
        if (!Number.isFinite(size) || size <= 0) {
            return null;
        }
        offsets.push(totalBytes);
        sizes.push(size);
        totalBytes += size;
    }
    return { offsets, sizes, totalBytes };
}
function aggregateProgressHandler(onProgress, context) {
    return (progress) => onProgress(frameProgress(progress, context));
}
function frameProgress(progress, context) {
    const assetDownloaded = Math.min(Math.max(progress.downloaded, 0), context.expectedSize);
    const overallDownloaded = Math.min(context.offset + assetDownloaded, context.totalBytes);
    const overallPercentage = Number(((overallDownloaded / context.totalBytes) * 100).toFixed(2));
    return {
        ...progress,
        fileSetInfo: {
            setKey: context.setKey,
            currentFile: context.currentFile,
            fileIndex: context.fileIndex,
            totalFiles: context.totalFiles,
            overallDownloaded,
            overallTotal: context.totalBytes,
            overallPercentage
        }
    };
}
