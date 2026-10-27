export class ModelDownloadStatus {
    _rows = new Map();
    _engine;
    _log;
    constructor(engine, logger = null) {
        this._engine = engine;
        this._log = logger;
    }
    async write(name, phase, patch = {}) {
        const previous = this._rows.get(name);
        const next = {
            phase,
            percentage: patch.percentage ?? previous?.percentage ?? 0,
            error: patch.error ?? null,
            downloaded: patch.downloaded ?? previous?.downloaded ?? 0,
            total: patch.total ?? previous?.total ?? 0,
            bytesPerSecond: patch.bytesPerSecond ?? previous?.bytesPerSecond ?? 0
        };
        if (sameStatus(previous, next)) {
            return true;
        }
        try {
            await this._engine.setModelDownloadStatus({ name, ...next });
            this._rows.set(name, next);
            return true;
        }
        catch (err) {
            this._log?.warn('model-download', 'local status write failed', err);
            return false;
        }
    }
    async clear(name) {
        if (!this._rows.has(name))
            return;
        try {
            await this._engine.clearModelDownload({ name });
            this._rows.delete(name);
        }
        catch (err) {
            this._log?.warn('model-download', 'local status clear failed', err);
        }
    }
    async clearUnwanted(wanted) {
        for (const name of [...this._rows.keys()]) {
            if (!wanted.has(name)) {
                await this.clear(name);
            }
        }
    }
}
function sameStatus(previous, next) {
    return (previous?.phase === next.phase &&
        previous.percentage === next.percentage &&
        previous.error === next.error &&
        previous.downloaded === next.downloaded &&
        previous.total === next.total &&
        previous.bytesPerSecond === next.bytesPerSecond);
}
