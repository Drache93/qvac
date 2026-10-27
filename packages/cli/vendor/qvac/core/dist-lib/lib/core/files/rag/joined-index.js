import { parseRagMetadata } from 'rag-extract';
export function joinedIndex(indexes, { chatId, knowledgeBaseIds }) {
    const distinct = [...new Set(indexes)];
    const asChat = (candidate) => {
        const metadata = parseRagMetadata(candidate.metadataJson);
        if (!metadata?.attachmentId || !knowledgeBaseIds.has(metadata.attachmentId)) {
            return candidate;
        }
        return { ...candidate, metadataJson: JSON.stringify({ ...metadata, chatId }) };
    };
    return {
        info() {
            const infos = distinct.map((index) => index.info());
            return {
                artifacts: infos.reduce((sum, info) => sum + info.artifacts, 0),
                chunks: infos.reduce((sum, info) => sum + info.chunks, 0),
                dimensions: infos.find((info) => info.dimensions !== null)?.dimensions ?? null
            };
        },
        async search(embedding, { limit, filter }) {
            const scoped = filter && ((candidate) => filter(asChat(candidate)));
            const found = await Promise.all(distinct.map((index) => index.search(embedding, { limit, filter: scoped })));
            return found
                .flat()
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        },
        upsert: readOnly,
        remove: readOnly,
        clear: readOnly
    };
}
function readOnly() {
    return Promise.reject(new Error('a joined index is read-only'));
}
