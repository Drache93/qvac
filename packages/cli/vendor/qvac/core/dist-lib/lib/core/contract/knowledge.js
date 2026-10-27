import { trackActivity } from './activity.js';
import { foreignChat } from './chat.js';
import { oldestVersion } from './oldest-version.js';
import { meshKind } from './mesh-kind.js';
import { inProject, signerMember } from './projects.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import { assertArtifactOutput } from '../files/index.js';
import { CHATS, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, KNOWLEDGE_CAPS } from '../collections.js';
export const KNOWLEDGE_CAP_ROW = 'mesh';
async function misplaced(tx, chatId) {
    if (chatId) {
        return foreignChat(tx, chatId);
    }
    return (await rulesVersion(tx)) >= WORKSPACES_RULES && (await meshKind(tx)) !== 'project';
}
export function registerKnowledgeRoutes(router) {
    router.add('@qvac/add-knowledge', trackActivity(async ({ knowledge }, { tx, log }) => {
        if (await misplaced(tx, knowledge.chatId)) {
            log?.warn('contract', 'add-knowledge dropped: its chat, or a knowledge base, is not here', {
                id: knowledge.id
            });
            return;
        }
        const chat = knowledge.chatId ? await tx.get(CHATS, { id: knowledge.chatId }) : null;
        if (chat?.deletedAt) {
            log?.debug('contract', 'add-knowledge dropped: chat is deleted', {
                chatId: knowledge.chatId,
                id: knowledge.id
            });
            return;
        }
        const existing = await tx.get(KNOWLEDGE, { id: knowledge.id });
        if (existing && existing.updatedAt > knowledge.updatedAt) {
            log?.debug('contract', 'add-knowledge dropped: stale updatedAt', { id: knowledge.id });
            return;
        }
        const row = oldestVersion({ ...knowledge, deletedBy: null });
        await tx.insert(KNOWLEDGE, row);
        return row;
    }));
    router.add('@qvac/remove-knowledge', trackActivity(async (op, context) => {
        const { tx, log } = context;
        const existing = await tx.get(KNOWLEDGE, { id: op.knowledgeId });
        if (!existing) {
            log?.debug('contract', 'remove-knowledge dropped: unknown knowledge', {
                id: op.knowledgeId
            });
            return;
        }
        if (existing.deletedAt) {
            return;
        }
        const updatedAt = Math.max(existing.updatedAt + 1, op.at);
        const deletedBy = existing.chatId ? null : await signerMember(context);
        const tombstoned = oldestVersion({ ...existing, deletedAt: op.at, deletedBy, updatedAt });
        await tx.insert(KNOWLEDGE, tombstoned);
        return tombstoned;
    }));
    router.add('@qvac/add-knowledge-artifact', trackActivity(async ({ artifact }, { tx, log }) => {
        try {
            assertArtifactOutput(artifact);
        }
        catch (error) {
            log?.debug('contract', 'artifact dropped: invalid output', { id: artifact.id, error });
            return;
        }
        const existing = await tx.get(KNOWLEDGE_ARTIFACTS, {
            id: artifact.id
        });
        if (existing) {
            return;
        }
        await tx.insert(KNOWLEDGE_ARTIFACTS, artifact);
        return artifact;
    }));
    router.add('@qvac/set-knowledge-cap', trackActivity(setKnowledgeCap));
}
async function setKnowledgeCap(op, context) {
    const { tx, log } = context;
    if ((await meshKind(tx)) !== 'project') {
        log?.warn('contract', 'set-knowledge-cap dropped: only a project has a knowledge base');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !(await inProject(tx, signer))) {
        log?.warn('contract', 'set-knowledge-cap dropped: the signer is outside the project');
        return;
    }
    if (op.bytes === 0) {
        log?.warn('contract', 'set-knowledge-cap dropped: a cap of 0 bytes');
        return;
    }
    const existing = await tx.get(KNOWLEDGE_CAPS, { id: KNOWLEDGE_CAP_ROW });
    if (existing && existing.setAt >= op.setAt) {
        log?.debug('contract', 'set-knowledge-cap dropped: stale setAt', { setAt: op.setAt });
        return;
    }
    const row = {
        id: KNOWLEDGE_CAP_ROW,
        bytes: op.bytes,
        setAt: op.setAt,
        setBy: signer
    };
    await tx.insert(KNOWLEDGE_CAPS, row);
    return row;
}
