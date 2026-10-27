import { trackActivity } from './activity.js';
import { oldestVersion } from './oldest-version.js';
import { claimSource } from '../files/index.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import b4a from 'b4a';
import { INDEXING_STATUS, INDEXING_STATUS_BY_KNOWLEDGE, KNOWLEDGE, KNOWLEDGE_ARTIFACTS } from '../collections.js';
export const INDEXING_CLAIM_TTL_MS = 10 * 60 * 1000;
export const INDEXING_STALE_MS = 2 * 60 * 1000;
export const INDEXING_MAX_CLOCK_SKEW_MS = 60 * 60 * 1000;
export function registerIndexingRoutes(router) {
    router.add('@qvac/claim-indexing', trackActivity(async (op, { tx, node, log }) => {
        const knowledge = await claimSource(tx, op.knowledgeId);
        if (!knowledge || knowledge.deletedAt) {
            log?.debug('contract', 'claim-indexing dropped: no live knowledge', { id: op.id });
            return;
        }
        const existing = await tx.get(INDEXING_STATUS, { id: op.id });
        if (existing) {
            if (existing.status === 'ready') {
                log?.debug('contract', 'claim-indexing dropped: already ready', { id: op.id });
                return;
            }
            const poisoned = existing.at > op.at + INDEXING_MAX_CLOCK_SKEW_MS ||
                existing.expiresAt > op.at + INDEXING_MAX_CLOCK_SKEW_MS + INDEXING_CLAIM_TTL_MS;
            if (!poisoned) {
                if (existing.status === 'indexing' && existing.expiresAt > op.at) {
                    log?.debug('contract', 'claim-indexing dropped: live claim', { id: op.id });
                    return;
                }
                if (op.at <= existing.at) {
                    log?.debug('contract', 'claim-indexing dropped: stale claim', { id: op.id });
                    return;
                }
            }
        }
        const claimed = oldestVersion({
            id: op.id,
            knowledgeId: op.knowledgeId,
            chatId: knowledge.chatId,
            status: 'indexing',
            claimId: op.claimId,
            claimedBy: node.key,
            at: op.at,
            expiresAt: op.at + (await claimLeaseMs(tx))
        });
        await tx.insert(INDEXING_STATUS, claimed);
        return claimed;
    }));
    router.add('@qvac/resolve-indexing', trackActivity(async (op, { tx, node, log }) => {
        const existing = await tx.get(INDEXING_STATUS, { id: op.id });
        if (!existing) {
            log?.debug('contract', 'resolve-indexing dropped: unknown row', { id: op.id });
            return;
        }
        if (existing.status !== 'indexing') {
            log?.debug('contract', 'resolve-indexing dropped: not in flight', { id: op.id });
            return;
        }
        if (existing.claimId !== op.claimId || !b4a.equals(existing.claimedBy, node.key)) {
            log?.debug('contract', 'resolve-indexing dropped: not the claim holder', { id: op.id });
            return;
        }
        const knowledge = await claimSource(tx, existing.knowledgeId);
        if (!knowledge || knowledge.deletedAt) {
            log?.debug('contract', 'resolve-indexing dropped: no live knowledge', { id: op.id });
            return;
        }
        if (op.status === 'ready') {
            const artifact = await tx.get(KNOWLEDGE_ARTIFACTS, { id: op.id });
            if (!artifact || artifact.knowledgeId !== existing.knowledgeId) {
                log?.debug('contract', 'resolve-indexing dropped: ready without its artifact', {
                    id: op.id
                });
                return;
            }
        }
        const settled = oldestVersion({
            ...existing,
            status: op.status,
            at: existing.at + 1,
            error: op.status === 'failed' ? (op.error ?? null) : null
        });
        await tx.insert(INDEXING_STATUS, settled);
        return settled;
    }));
    router.add('@qvac/progress-indexing', trackActivity(async (op, { tx, node, log }) => {
        const existing = await tx.get(INDEXING_STATUS, { id: op.id });
        if (!existing ||
            existing.status !== 'indexing' ||
            existing.claimId !== op.claimId ||
            !b4a.equals(existing.claimedBy, node.key)) {
            log?.debug('contract', 'progress-indexing dropped: not the claim holder', { id: op.id });
            return;
        }
        const expiresAt = Math.max(existing.expiresAt, op.at + INDEXING_STALE_MS);
        if (expiresAt === existing.expiresAt) {
            return existing;
        }
        const progressed = oldestVersion({ ...existing, expiresAt });
        await tx.insert(INDEXING_STATUS, progressed);
        return progressed;
    }));
    router.add('@qvac/retry-indexing', trackActivity(async (op, { tx, log }) => {
        const knowledge = await tx.get(KNOWLEDGE, { id: op.knowledgeId });
        if (!knowledge || knowledge.deletedAt) {
            log?.debug('contract', 'retry-indexing dropped: no live knowledge', {
                knowledgeId: op.knowledgeId
            });
            return;
        }
        const rows = await tx
            .find(INDEXING_STATUS_BY_KNOWLEDGE, {
            gte: { knowledgeId: op.knowledgeId },
            lte: { knowledgeId: op.knowledgeId }
        })
            .toArray();
        const cleared = rows.filter((row) => row.status === 'failed' && row.at < op.at);
        for (const row of cleared) {
            await tx.delete(INDEXING_STATUS, { id: row.id });
        }
        return cleared.length > 0;
    }));
}
async function claimLeaseMs(tx) {
    return (await rulesVersion(tx)) >= WORKSPACES_RULES ? INDEXING_STALE_MS : INDEXING_CLAIM_TTL_MS;
}
