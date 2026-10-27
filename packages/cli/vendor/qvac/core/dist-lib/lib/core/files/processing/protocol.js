import { INDEXING_CLAIM_TTL_MS, INDEXING_MAX_CLOCK_SKEW_MS } from '../../contract/indexing.js';
import { randomId } from '../../id.js';
import b4a from 'b4a';
export { INDEXING_CLAIM_TTL_MS, INDEXING_MAX_CLOCK_SKEW_MS, INDEXING_STALE_MS } from '../../contract/indexing.js';
import { INDEXING_STATUS, INDEXING_STATUS_BY_CHAT, INDEXING_STATUS_BY_KNOWLEDGE } from '../../collections.js';
export function isClaimLive(row, at) {
    return (row.status === 'indexing' &&
        row.expiresAt > at &&
        row.at <= at + INDEXING_MAX_CLOCK_SKEW_MS &&
        row.expiresAt <= at + INDEXING_MAX_CLOCK_SKEW_MS + INDEXING_CLAIM_TTL_MS);
}
export async function getIndexingStatus(store, artifactId) {
    const snap = store.view.snapshot();
    try {
        const status = await snap.get(INDEXING_STATUS, { id: artifactId });
        return status;
    }
    finally {
        await snap.close();
    }
}
async function mustGetIndexingStatus(store, artifactId) {
    const row = await getIndexingStatus(store, artifactId);
    if (!row) {
        throw new Error(`indexing status not found: ${artifactId}`);
    }
    return row;
}
export async function listIndexingByKnowledge(store, { knowledgeId }) {
    const snap = store.view.snapshot();
    try {
        const rows = await snap
            .find(INDEXING_STATUS_BY_KNOWLEDGE, {
            gte: { knowledgeId },
            lte: { knowledgeId }
        })
            .toArray();
        return rows;
    }
    finally {
        await snap.close();
    }
}
export async function listIndexingByChat(store, { chatId }) {
    const snap = store.view.snapshot();
    try {
        const rows = await snap
            .find(INDEXING_STATUS_BY_CHAT, {
            gte: { chatId },
            lte: { chatId }
        })
            .toArray();
        return rows;
    }
    finally {
        await snap.close();
    }
}
export async function claimIndexing(store, { artifactId, knowledgeId, at }) {
    if (!at || at < 0) {
        throw new Error(`claim-indexing needs a positive timestamp, got ${at}`);
    }
    const claimId = randomId();
    await store.dispatch('claim-indexing', { id: artifactId, knowledgeId, claimId, at });
    const row = await mustGetIndexingStatus(store, artifactId);
    const won = row.status === 'indexing' && row.claimId === claimId;
    return { row, won };
}
export async function progressIndexing(store, { artifactId, claimId, at }) {
    await store.dispatch('progress-indexing', { id: artifactId, claimId, at });
    const row = await getIndexingStatus(store, artifactId);
    return (row?.status === 'indexing' &&
        row.claimId === claimId &&
        b4a.equals(row.claimedBy, store.localWriterKey));
}
export async function resolveIndexing(store, { artifactId, claimId, status, error }) {
    await store.dispatch('resolve-indexing', { id: artifactId, claimId, status, error });
    const row = await mustGetIndexingStatus(store, artifactId);
    const applied = row.status === status && row.claimId === claimId;
    return { row, applied };
}
