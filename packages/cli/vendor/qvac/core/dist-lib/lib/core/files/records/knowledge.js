import { CoreError } from '../../../errors.js';
import { randomId } from '../../id.js';
import { assertArtifactOutput } from './output.js';
import { DEFAULT_KNOWLEDGE_CAP_BYTES } from '../rag/limits.js';
import { KNOWLEDGE_CAP_ROW } from '../../contract/knowledge.js';
import { ACTIVE_KNOWLEDGE_BASE, ACTIVE_KNOWLEDGE_BY_CHAT, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, KNOWLEDGE_CAPS } from '../../collections.js';
export async function getKnowledge(store, id) {
    const snap = store.view.snapshot();
    try {
        const row = await snap.get(KNOWLEDGE, { id });
        return row;
    }
    finally {
        await snap.close();
    }
}
export async function mustGetKnowledge(store, id) {
    const row = await getKnowledge(store, id);
    if (!row) {
        throw new CoreError('KNOWLEDGE_NOT_FOUND', [id]);
    }
    return row;
}
export async function listKnowledge(store, { chatId }) {
    const snap = store.view.snapshot();
    try {
        const rows = await snap
            .find(ACTIVE_KNOWLEDGE_BY_CHAT, { gte: { chatId }, lte: { chatId } })
            .toArray();
        return rows;
    }
    finally {
        await snap.close();
    }
}
export async function listKnowledgeBase(store) {
    const snap = store.view.snapshot();
    try {
        return await snap.find(ACTIVE_KNOWLEDGE_BASE).toArray();
    }
    finally {
        await snap.close();
    }
}
export function usedKnowledgeBytes(rows) {
    return rows.reduce((sum, row) => sum + row.byteLength, 0);
}
export async function knowledgeCapBytes(db) {
    const row = await db.get(KNOWLEDGE_CAPS, { id: KNOWLEDGE_CAP_ROW });
    return row?.bytes ?? DEFAULT_KNOWLEDGE_CAP_BYTES;
}
async function knowledgeRoom(store) {
    const snap = store.view.snapshot();
    try {
        const rows = await snap.find(ACTIVE_KNOWLEDGE_BASE).toArray();
        const capBytes = await knowledgeCapBytes(snap);
        return { capBytes, bytes: Math.max(0, capBytes - usedKnowledgeBytes(rows)) };
    }
    finally {
        await snap.close();
    }
}
export async function assertKnowledgeRoom(store, bytes) {
    const room = await knowledgeRoom(store);
    if (bytes > room.bytes) {
        throw new CoreError('KNOWLEDGE_CAP_REACHED', [room.capBytes]);
    }
    return room;
}
export async function addKnowledge(store, input) {
    const now = Date.now();
    const knowledge = {
        ...input,
        id: input.id ?? randomId(),
        createdAt: now,
        updatedAt: now
    };
    await store.dispatch('add-knowledge', { knowledge });
    return await mustGetKnowledge(store, knowledge.id);
}
export function assertRemovableAt(at) {
    if (!at || at < 0) {
        throw new Error(`remove-knowledge needs a positive timestamp, got ${at}`);
    }
}
export async function removeKnowledge(store, { knowledgeId, at }) {
    assertRemovableAt(at);
    const existing = await mustGetKnowledge(store, knowledgeId);
    if (existing.deletedAt) {
        return existing;
    }
    await store.dispatch('remove-knowledge', { knowledgeId, at });
    const removed = await mustGetKnowledge(store, knowledgeId);
    return removed;
}
const ARTIFACT_STRING_FIELDS = [
    'id',
    'knowledgeId',
    'sourceHash',
    'embedderVersion',
    'artifactBlobId'
];
export async function getKnowledgeArtifact(store, id) {
    const snap = store.view.snapshot();
    try {
        const artifact = await snap.get(KNOWLEDGE_ARTIFACTS, { id });
        return artifact;
    }
    finally {
        await snap.close();
    }
}
export async function listKnowledgeArtifactsByKnowledge(store, { knowledgeId }) {
    const snap = store.view.snapshot();
    try {
        return await findKnowledgeArtifactsByKnowledge(snap, knowledgeId);
    }
    finally {
        await snap.close();
    }
}
export async function findKnowledgeArtifactsByKnowledge(snap, knowledgeId) {
    return await snap
        .find(KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, {
        gte: { knowledgeId },
        lte: { knowledgeId }
    })
        .toArray();
}
export async function addKnowledgeArtifact(store, input) {
    for (const field of ARTIFACT_STRING_FIELDS) {
        if (!input[field]) {
            throw new Error(`knowledge-artifact needs a non-empty ${field}`);
        }
    }
    assertArtifactOutput(input);
    await store.dispatch('add-knowledge-artifact', { artifact: { ...input, createdAt: Date.now() } });
    const row = await getKnowledgeArtifact(store, input.id);
    if (!row) {
        throw new Error(`knowledge-artifact not found after add: ${input.id}`);
    }
    return row;
}
