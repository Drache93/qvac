import b4a from 'b4a';
import { fileKeyOf } from '../local-index.js';
import { referencedBlobs } from './sweep.js';
import { findChunksOfType } from '../../chunk.js';
import { KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, KNOWLEDGE_BY_CHAT, PURGED_CHATS } from '../../collections.js';
export async function reclaimPurgedFiles(mesh) {
    const index = mesh.fileIndex;
    if (!index) {
        return 0;
    }
    const rows = await index.list();
    const purged = await purgedChats(mesh, rows);
    if (purged.size) {
        await index.retireChats(purged);
    }
    const candidates = rows.filter((row) => !!row.chatId && purged.has(row.chatId));
    if (candidates.length === 0) {
        return 0;
    }
    const owner = ownerOf(mesh);
    const referenced = await referencedKeys(mesh, owner);
    const cores = new Map();
    let reclaimed = 0;
    for (const row of candidates) {
        if (mesh.closing)
            break;
        if (referenced.has(keyId(row)))
            continue;
        if (!(await mesh.files.clear(row.blobId, row.attachmentId ?? row.blobId))) {
            continue;
        }
        await index.forget(row);
        cores.set(b4a.toHex(row.coreKey), row.coreKey);
        reclaimed++;
    }
    if (cores.size > 0 && !mesh.closing) {
        await mesh.files.compact([...cores.values()]);
    }
    return reclaimed;
}
export async function chatReferences(mesh, chatId) {
    const references = [];
    const inChat = { gte: { chatId }, lte: { chatId } };
    const snap = mesh.view.snapshot();
    try {
        for (const chunk of await findChunksOfType(snap, { chatId, type: 'attachment' })) {
            if (chunk.attachment) {
                references.push(chunk.attachment.blobId);
            }
        }
        for (const row of await snap.find(KNOWLEDGE_BY_CHAT, inChat).toArray()) {
            references.push(row.blobId);
            const ofKnowledge = { gte: { knowledgeId: row.id }, lte: { knowledgeId: row.id } };
            for await (const artifact of snap.find(KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, ofKnowledge)) {
                references.push(artifact.artifactBlobId);
            }
        }
    }
    finally {
        await snap.close();
    }
    return references;
}
export async function reclaimReferences(mesh, references) {
    if (references.length === 0)
        return;
    const owner = ownerOf(mesh);
    const referenced = await referencedKeys(mesh, owner);
    const cores = new Map();
    for (const reference of references) {
        if (mesh.closing)
            return;
        const key = fileKeyOf(reference, owner);
        if (!key || referenced.has(keyId(key))) {
            continue;
        }
        if (!(await mesh.files.clear(reference, reference))) {
            continue;
        }
        await mesh.fileIndex?.forget(key);
        cores.set(b4a.toHex(key.coreKey), key.coreKey);
    }
    if (cores.size > 0) {
        void mesh.files.compact([...cores.values()]);
    }
}
async function purgedChats(mesh, rows) {
    const purged = new Map();
    const chatIds = rows.map((row) => row.chatId).filter((id) => !!id);
    for (const chatId of new Set(chatIds)) {
        const row = await mesh.view.get(PURGED_CHATS, { chatId });
        if (row) {
            purged.set(chatId, row.at);
        }
    }
    return purged;
}
function ownerOf(mesh) {
    return { meshKey: mesh.key, ownCoreKey: mesh.blobs.core.key };
}
async function referencedKeys(mesh, owner) {
    const keys = new Set();
    for (const reference of await referencedBlobs(mesh)) {
        const key = fileKeyOf(reference, owner);
        if (key) {
            keys.add(keyId(key));
        }
    }
    return keys;
}
function keyId(key) {
    return `${b4a.toHex(key.coreKey)}/${key.blockOffset}`;
}
