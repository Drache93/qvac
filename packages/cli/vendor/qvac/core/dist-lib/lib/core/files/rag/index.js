import ScopeLock from 'scope-lock';
import { pipelineVersionFor } from 'rag-extract';
import { AbortedError } from '@qvac/harness/race-abort';
import { IndexingPass } from './produce.js';
import { HydratePass } from './load.js';
import { canIndexKnowledge } from './policy.js';
export class RagProcessor {
    id = 'rag';
    input = 'knowledge';
    output = 'blob';
    version;
    _producer;
    _device;
    load;
    _index;
    _log;
    constructor(options) {
        this.version = pipelineVersionFor(options.model);
        this._index = options.index ?? null;
        this._log = options.log;
        this._device = options.device;
        const lock = options.batches ?? new ScopeLock();
        const source = options.embedder;
        const embedder = source && {
            model: source.model,
            idle: async (signal) => {
                await source.idle?.(signal);
            },
            embed: async (input) => {
                await lock.lock();
                try {
                    if (input.signal?.aborted) {
                        throw new AbortedError();
                    }
                    return await source.embed(input);
                }
                finally {
                    lock.unlock();
                }
            }
        };
        this._producer = embedder ? new IndexingPass(embedder, options.extractors) : null;
        if (this._index) {
            const loader = new HydratePass({ ...options, index: this._index, embedder });
            this.load = (document, signal) => this._settled(document, loader.run(document, signal));
        }
    }
    applies(_document) {
        return true;
    }
    async canProduce(document, host) {
        return (!!this._producer &&
            !document.deletedAt &&
            (await canIndexKnowledge(host.mesh, {
                deviceId: host.deviceId,
                chatId: document.chatId,
                device: host.device
            })));
    }
    async produce(document, signal) {
        await this._settled(document, this._producer?.run(document, signal));
    }
    async _settled(document, run) {
        try {
            await run;
        }
        finally {
            if (!document.record.chatId && this._device?.mobile()) {
                await document.clearFetched();
            }
        }
    }
    async evict(loaded) {
        if (loaded.evict) {
            await this._index?.remove(loaded.evict);
        }
        await this._index?.remove(loaded.artifactId);
    }
    async close() {
        try {
            await this._index?.clear();
            return true;
        }
        catch (err) {
            this._log?.warn('rag', 'vector index clear failed on close; it must not be reused', { err });
            return false;
        }
    }
}
export { MAX_KNOWLEDGE_BYTES } from './limits.js';
export { joinedIndex } from './joined-index.js';
export { canIndexKnowledge } from './policy.js';
export { formatFullDocumentContext, fullTextBudgetChars, fullTextHits, isFullTextHit, isTruncatedFullTextHit } from './retrieval/full-text.js';
export { MemoryVectorIndex, RAG_DOCUMENT_KIND, RAG_KNOWLEDGE_OFF_NOTICE, RAG_TRUNCATED_NOTICE, RAG_UNAVAILABLE_NOTICE, WEB_TOOLS, chooseRagNotice, citedByPhraseOverlap, classifyRagDocument, createRagSourceTagFilter, encodeRagArtifact, formatRagContext, isSupportedRagDocument, isWholeDocumentQuery, referencedDocuments, referencesPendingFile, retrieveRagKnowledge, searchRagChunks, sourcesFromHits, webSourcesFromToolResult, withoutDataChannel } from 'rag-extract';
