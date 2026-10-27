import b4a from 'b4a';
import { toolsetEnabled } from '@qvac/harness/lib/tools/toolsets.ts';
import { ACTIVE_CHATS_BY_AGENT, AGENTS, AGENTS_BY_PROVIDER, CHATS, CHUNKS, DEVICES, INDEXING_STATUS, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, KNOWLEDGE_BY_CHAT } from '../collections.js';
import { findChunksOfType } from '../chunk.js';
import { changed, liveRow } from './changed.js';
export class FileChanges {
    _snap;
    _from;
    _documents = new Set();
    _chats = new Set();
    _agents = new Set();
    _devices = new Map();
    constructor(snap, from) {
        this._snap = snap;
        this._from = from;
    }
    async add(change) {
        if (changed(change, CHUNKS)) {
            const chunk = liveRow(change);
            if (chunk && isCanonicalAttachment(chunk)) {
                this._documents.add(chunk.id);
            }
        }
        else if (changed(change, KNOWLEDGE)) {
            this._documents.add(change.value.id);
        }
        else if (changed(change, KNOWLEDGE_ARTIFACTS) || changed(change, INDEXING_STATUS)) {
            const row = liveRow(change) ?? (await this._was(change));
            if (row) {
                this._documents.add(row.knowledgeId);
            }
        }
        else if (changed(change, CHATS)) {
            const [was, now] = [await this._was(change), liveRow(change)];
            if (!was || !now || was.agentId !== now.agentId || !!was.deletedAt !== !!now.deletedAt) {
                this._chats.add(change.value.id);
            }
        }
        else if (changed(change, AGENTS)) {
            const [was, now] = [await this._was(change), liveRow(change)];
            if (!was || !now || movedKnowledge(was, now)) {
                this._agents.add(change.value.id);
            }
        }
        else if (changed(change, DEVICES)) {
            const [was, now] = [await this._was(change), liveRow(change)];
            if (!was || !now || !!was.revoked !== !!now.revoked) {
                this._devices.set(b4a.toHex(change.value.id), change.value.id);
            }
        }
    }
    _was(change) {
        const query = { id: change.value.id };
        return this._snap.get(change.collection, query, { checkout: this._from });
    }
    async ids() {
        for (const providerDeviceId of this._devices.values()) {
            const range = { gte: { providerDeviceId }, lte: { providerDeviceId } };
            for await (const agent of this._snap.find(AGENTS_BY_PROVIDER, range)) {
                this._agents.add(agent.id);
            }
        }
        for (const agentId of this._agents) {
            for await (const chat of this._snap.find(ACTIVE_CHATS_BY_AGENT, {
                gte: { agentId },
                lte: { agentId }
            })) {
                this._chats.add(chat.id);
            }
        }
        for (const chatId of this._chats) {
            for await (const document of this._snap.find(KNOWLEDGE_BY_CHAT, {
                gte: { chatId },
                lte: { chatId }
            })) {
                this._documents.add(document.id);
            }
            for (const chunk of await findChunksOfType(this._snap, { chatId, type: 'attachment' })) {
                if (isCanonicalAttachment(chunk)) {
                    this._documents.add(chunk.id);
                }
            }
        }
        return this._documents;
    }
}
function movedKnowledge(was, now) {
    return (!b4a.equals(was.providerDeviceId, now.providerDeviceId) ||
        !!was.deletedAt !== !!now.deletedAt ||
        toolsetEnabled('knowledge', was.disabledToolsets) !==
            toolsetEnabled('knowledge', now.disabledToolsets));
}
function isCanonicalAttachment(chunk) {
    return !!chunk.attachment && chunk.id === chunk.attachment.id;
}
