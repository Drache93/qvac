import b4a from 'b4a';
import { LOCAL_CONFIG, LOCAL_FILES, LOCAL_FILES_BY_BLOB, LOCAL_LIVE_FILES, LOCAL_RECLAIMABLE_FILES_BY_LAST_ACCESSED } from '../collections.js';
const TOUCH_GRAIN_MS = 60 * 60 * 1000;
export class LocalFiles {
    _db;
    _locked;
    constructor(db, locked) {
        this._db = db;
        this._locked = locked;
    }
    record(files, now = Date.now()) {
        return this._write(files, (file, known) => {
            if (known && described(known, file)) {
                return null;
            }
            return {
                ...merged(known, file),
                own: file.own || (known?.own ?? false),
                lastAccessed: known?.lastAccessed ?? now,
                cleared: known?.cleared ?? false
            };
        });
    }
    refresh(files) {
        return this._write(files, (file, known) => {
            if (!known || described(known, file)) {
                return null;
            }
            return { ...known, ...merged(known, file) };
        });
    }
    read(file, now = Date.now()) {
        return this._write([file], (_, known) => {
            if (known && readRecently(known, now)) {
                return null;
            }
            return {
                ...merged(known, file),
                own: file.own || (known?.own ?? false),
                lastAccessed: now,
                cleared: false
            };
        });
    }
    touch(key, now = Date.now()) {
        return this._write([key], (_, known) => {
            if (!known || readRecently(known, now)) {
                return null;
            }
            return { ...known, lastAccessed: now, cleared: false };
        });
    }
    _write(files, next) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            let changed = false;
            for (const file of files) {
                const known = await tx.get(LOCAL_FILES, keyOf(file));
                const row = next(file, known);
                if (!row) {
                    continue;
                }
                await tx.insert(LOCAL_FILES, row);
                changed = true;
            }
            if (changed) {
                await tx.flush();
            }
            else {
                await tx.close();
            }
        });
    }
    markCleared(file) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            const known = await tx.get(LOCAL_FILES, keyOf(file));
            if (!known) {
                await tx.close();
                return;
            }
            await tx.insert(LOCAL_FILES, { ...known, cleared: true });
            await tx.flush();
        });
    }
    retireChats(meshKey, purged) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            let changed = false;
            for (const row of await tx.find(LOCAL_FILES, meshRange(meshKey)).toArray()) {
                const at = row.chatId ? purged.get(row.chatId) : undefined;
                if (!at || row.deletedAt) {
                    continue;
                }
                await tx.insert(LOCAL_FILES, { ...row, deletedAt: at });
                changed = true;
            }
            if (changed) {
                await tx.flush();
            }
            else {
                await tx.close();
            }
        });
    }
    forget(file) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            if (!(await tx.get(LOCAL_FILES, keyOf(file)))) {
                await tx.close();
                return;
            }
            await tx.delete(LOCAL_FILES, keyOf(file));
            await tx.flush();
        });
    }
    async meshOf(coreKey, blockOffset) {
        const key = { coreKey, blockOffset };
        const row = await this._db.findOne(LOCAL_FILES_BY_BLOB, { gte: key, lte: key });
        return row?.meshKey ?? null;
    }
    async backfilled(meshKey) {
        return ((await this._db.get(LOCAL_CONFIG, { key: backfillKey(meshKey) })) !== null);
    }
    markBackfilled(meshKey) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await tx.insert(LOCAL_CONFIG, { key: backfillKey(meshKey), value: true });
            await tx.flush();
        });
    }
    list(meshKey) {
        return this._db.find(LOCAL_FILES, meshRange(meshKey)).toArray();
    }
    live(meshKey) {
        return this._db.find(LOCAL_LIVE_FILES, meshRange(meshKey)).toArray();
    }
    stale(cutoff) {
        return this._db
            .find(LOCAL_RECLAIMABLE_FILES_BY_LAST_ACCESSED, { lt: { lastAccessed: cutoff } })
            .toArray();
    }
}
export async function dropMeshFileCursors(tx, meshKey) {
    await tx.delete(LOCAL_CONFIG, { key: backfillKey(meshKey) });
    await tx.delete(LOCAL_CONFIG, { key: backgroundSyncKey(meshKey) });
}
export function backgroundSyncKey(meshKey) {
    return `sync/background/${b4a.toHex(meshKey)}`;
}
function meshRange(meshKey) {
    return meshKey ? { gte: { meshKey }, lte: { meshKey } } : {};
}
function backfillKey(meshKey) {
    return `files/backfilled/${b4a.toHex(meshKey)}`;
}
function readRecently(known, now) {
    return !known.cleared && now - known.lastAccessed < TOUCH_GRAIN_MS;
}
function keyOf(file) {
    return { meshKey: file.meshKey, coreKey: file.coreKey, blockOffset: file.blockOffset };
}
function merged(known, file) {
    return {
        ...file,
        chatId: file.chatId ?? known?.chatId,
        attachmentId: file.attachmentId ?? known?.attachmentId,
        fileName: file.fileName ?? known?.fileName,
        mimeType: file.mimeType ?? known?.mimeType,
        byteLength: file.byteLength ?? known?.byteLength,
        deletedAt: file.deletedAt ?? known?.deletedAt
    };
}
function described(known, file) {
    const next = merged(known, file);
    return ((!file.own || known.own === true) &&
        next.blobId === known.blobId &&
        next.chatId === known.chatId &&
        next.attachmentId === known.attachmentId &&
        next.fileName === known.fileName &&
        next.mimeType === known.mimeType &&
        next.byteLength === known.byteLength &&
        next.deletedAt === known.deletedAt);
}
