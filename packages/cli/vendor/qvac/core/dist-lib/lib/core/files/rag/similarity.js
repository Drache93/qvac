import { applySimilarityFloor, logSimilarityScores as traceSimilarityScores, RAG_MIN_SIMILARITY } from 'rag-extract/retrieval';
export { applySimilarityFloor, RAG_MIN_SIMILARITY };
export function logSimilarityScores(candidates, kept, log) {
    traceSimilarityScores(candidates, kept, (message) => log?.debug('rag', message));
}
