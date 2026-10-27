import { isRecord } from './guards.js';
const EMA_WEIGHT = 0.25;
const STALL_MS = 2_000;
const NO_BYTES = { downloaded: 0, total: 0, aggregate: false };
export function transferProgress(event) {
    const aggregate = aggregateTransfer(event.fileSetInfo) ?? aggregateTransfer(event.shardInfo);
    if (aggregate) {
        return aggregate;
    }
    const bytes = { downloaded: uint(event.downloaded), total: uint(event.total), aggregate: false };
    const reported = reportedPercentage(event.percentage);
    if (reported === null && bytes.downloaded === 0 && bytes.total === 0) {
        return null;
    }
    return { ...bytes, percentage: resolvePercentage(reported, bytes) };
}
export function progressBytes(event) {
    const transfer = transferProgress(event);
    if (!transfer) {
        return NO_BYTES;
    }
    return {
        downloaded: transfer.downloaded,
        total: transfer.total,
        aggregate: transfer.aggregate
    };
}
export class DownloadSpeedSampler {
    _downloaded = null;
    _at = 0;
    _bytesPerSecond = 0;
    _downloadKey = null;
    sample(bytes, at, downloadKey) {
        const key = typeof downloadKey === 'string' ? downloadKey : null;
        const keyChanged = !bytes.aggregate && this._downloaded !== null && key !== this._downloadKey;
        if (this._downloaded === null || bytes.downloaded < this._downloaded || keyChanged) {
            this._reset(bytes.downloaded, at, key);
            return 0;
        }
        const elapsedMs = at - this._at;
        if (elapsedMs <= 0) {
            return Math.round(this._bytesPerSecond);
        }
        const delta = bytes.downloaded - this._downloaded;
        if (delta === 0) {
            if (elapsedMs >= STALL_MS) {
                this._bytesPerSecond = 0;
                this._at = at;
            }
            return Math.round(this._bytesPerSecond);
        }
        this._downloaded = bytes.downloaded;
        this._at = at;
        this._downloadKey = key;
        const measured = (delta * 1000) / elapsedMs;
        this._bytesPerSecond =
            this._bytesPerSecond > 0
                ? EMA_WEIGHT * measured + (1 - EMA_WEIGHT) * this._bytesPerSecond
                : measured;
        return Math.max(0, Math.round(this._bytesPerSecond));
    }
    _reset(downloaded, at, downloadKey) {
        this._downloaded = downloaded;
        this._at = at;
        this._bytesPerSecond = 0;
        this._downloadKey = downloadKey;
    }
}
function aggregateTransfer(value) {
    if (!isRecord(value))
        return null;
    const bytes = {
        downloaded: uint(value.overallDownloaded),
        total: uint(value.overallTotal),
        aggregate: true
    };
    const reported = reportedPercentage(value.overallPercentage);
    if (bytes.downloaded === 0 && bytes.total === 0) {
        return reported !== null && reported > 0 ? { ...bytes, percentage: reported } : null;
    }
    return { ...bytes, percentage: resolvePercentage(reported, bytes) };
}
function resolvePercentage(reported, bytes) {
    return reported !== null && reported > 0 ? reported : bytesPercentage(bytes);
}
function reportedPercentage(value) {
    return typeof value === 'number' && Number.isFinite(value) ? percentage(value) : null;
}
function bytesPercentage(bytes) {
    return bytes.total > 0 ? percentage((bytes.downloaded / bytes.total) * 100) : 0;
}
function uint(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
function percentage(value) {
    return Math.max(0, Math.min(100, Math.floor(value)));
}
