import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { LOCAL_RUN_LOGS, LOCAL_RUN_LOG_STEPS } from '../collections.js';
import { CoreError } from '../../errors.js';
import { isRecord } from '../../guards.js';
export const RUN_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export class LocalRunLogs {
    _db;
    _locked;
    constructor(db, locked) {
        this._db = db;
        this._locked = locked;
    }
    begin({ meshKey, runId }, now = Date.now()) {
        return this._locked(async () => {
            const cursor = await this._db.get(LOCAL_RUN_LOGS, { meshKey, runId });
            const generation = b4a.toHex(crypto.randomBytes(16));
            const row = cursor
                ? { ...cursor, generation, updatedAt: now }
                : {
                    meshKey,
                    runId,
                    generation,
                    nextSeq: 0,
                    length: 0,
                    digestKey: crypto.randomBytes(32),
                    updatedAt: now
                };
            const tx = this._db.transaction();
            await tx.insert(LOCAL_RUN_LOGS, row);
            await tx.flush();
            const steps = cursor ? await this._steps({ meshKey, runId }) : [];
            return { generation, digestKey: row.digestKey, steps };
        });
    }
    append({ meshKey, runId, generation, step }, now = Date.now()) {
        return this._locked(async () => {
            const cursor = await this._live({ meshKey, runId, generation });
            if (step.seq !== cursor.nextSeq || step.expectedLength !== cursor.length) {
                throw new CoreError('RUN_LOG_STEP_OUT_OF_ORDER', [runId, cursor.nextSeq]);
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_RUN_LOG_STEPS, {
                meshKey,
                runId,
                seq: step.seq,
                step
            });
            await tx.insert(LOCAL_RUN_LOGS, {
                ...cursor,
                nextSeq: cursor.nextSeq + 1,
                length: cursor.length + step.records.length,
                updatedAt: now
            });
            await tx.flush();
        });
    }
    release({ meshKey, runId, generation }, now = Date.now()) {
        return this._locked(async () => {
            const cursor = await this._db.get(LOCAL_RUN_LOGS, { meshKey, runId });
            if (!cursor?.generation) {
                return;
            }
            if (cursor.generation !== generation) {
                throw new CoreError('RUN_LOG_STALE_GENERATION', [runId]);
            }
            const tx = this._db.transaction();
            await tx.insert(LOCAL_RUN_LOGS, { ...cursor, generation: null, updatedAt: now });
            await tx.flush();
        });
    }
    drop(key) {
        return this._locked(async () => {
            const tx = this._db.transaction();
            await deleteLog(tx, key);
            await tx.flush();
        });
    }
    sweep(now = Date.now()) {
        return this._locked(async () => {
            const cursors = await this._db.find(LOCAL_RUN_LOGS).toArray();
            const expired = cursors.filter((cursor) => now - cursor.updatedAt > RUN_LOG_RETENTION_MS);
            if (expired.length === 0) {
                return 0;
            }
            const tx = this._db.transaction();
            for (const cursor of expired) {
                await deleteLog(tx, cursor);
            }
            await tx.flush();
            return expired.length;
        });
    }
    async _live({ meshKey, runId, generation }) {
        const cursor = await this._db.get(LOCAL_RUN_LOGS, { meshKey, runId });
        if (!cursor?.generation || cursor.generation !== generation) {
            throw new CoreError('RUN_LOG_STALE_GENERATION', [runId]);
        }
        return cursor;
    }
    async _steps({ meshKey, runId }) {
        const rows = await this._db
            .find(LOCAL_RUN_LOG_STEPS, {
            gte: { meshKey, runId },
            lte: { meshKey, runId }
        })
            .toArray();
        return rows.map((row) => row.step).filter(isRunLogStep);
    }
}
async function deleteLog(tx, { meshKey, runId }) {
    const steps = await tx
        .find(LOCAL_RUN_LOG_STEPS, {
        gte: { meshKey, runId },
        lte: { meshKey, runId }
    })
        .toArray();
    for (const { seq } of steps) {
        await tx.delete(LOCAL_RUN_LOG_STEPS, { meshKey, runId, seq });
    }
    await tx.delete(LOCAL_RUN_LOGS, { meshKey, runId });
}
export function isRunLogStep(value) {
    if (!isRecord(value)) {
        return false;
    }
    const { seq, expectedLength, records } = value;
    return (Number.isSafeInteger(seq) &&
        Number.isSafeInteger(expectedLength) &&
        Array.isArray(records) &&
        records.length > 0);
}
