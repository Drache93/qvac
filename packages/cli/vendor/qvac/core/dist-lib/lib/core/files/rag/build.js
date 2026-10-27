import { chunkRagDocuments, extractRagDocumentFromBytes } from 'rag-extract';
import { AbortedError } from '@qvac/harness/race-abort';
import { errorMessage } from '../../../guards.js';
import { IndexingFailure } from './failure.js';
const EMBED_BATCH = 8;
export class EmbedderFailure extends Error {
    constructor(cause) {
        super(errorMessage(cause), { cause });
        this.name = 'EmbedderFailure';
    }
}
export async function yieldTurn(signal) {
    await new Promise((resolve) => setImmediate(resolve));
    if (signal.aborted) {
        throw new AbortedError();
    }
}
export async function buildArtifactPayload(input) {
    const { embedder, knowledge, artifactId, bytes, signal, onProgress, onExtracted, extractors } = input;
    const document = await extractRagDocumentFromBytes({
        id: artifactId,
        artifactId,
        attachmentId: knowledge.id,
        chatId: knowledge.chatId ?? undefined,
        blobId: knowledge.blobId,
        fileName: knowledge.fileName,
        mimeType: knowledge.mimeType,
        bytes
    }, { extractors, signal });
    await yieldTurn(signal);
    await onExtracted?.();
    const chunks = chunkRagDocuments([document], {});
    if (!document.content.trim() || chunks.length === 0) {
        throw new IndexingFailure('no-text', `no extractable text: ${knowledge.fileName}`);
    }
    await onProgress?.(0, chunks.length);
    const vectors = [];
    for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
        await yieldTurn(signal);
        if (!knowledge.chatId) {
            await embedder.idle?.(signal);
        }
        const batch = chunks.slice(start, start + EMBED_BATCH);
        let rows;
        try {
            rows = await embedder.embed({ texts: batch.map((c) => c.content), signal });
        }
        catch (err) {
            throw new EmbedderFailure(err);
        }
        vectors.push(...rows);
        await onProgress?.(Math.min(start + batch.length, chunks.length), chunks.length);
    }
    if (vectors.length !== chunks.length) {
        throw new Error(`embedder returned ${vectors.length} vectors for ${chunks.length} chunks`);
    }
    const dimensions = vectors[0]?.length ?? 0;
    if (dimensions <= 0 || vectors.some((v) => v.length !== dimensions)) {
        throw new Error('embedder returned inconsistent dimensions');
    }
    return {
        modelName: embedder.model,
        dimensions,
        chunks: chunks.map((chunk, i) => ({
            id: chunk.id,
            content: chunk.content,
            metadataJson: chunk.metadataJson,
            embedding: vectors[i]
        }))
    };
}
