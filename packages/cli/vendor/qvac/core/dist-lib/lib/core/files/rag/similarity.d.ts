import type { LoggerInterface } from '@qvac/logging';
import { applySimilarityFloor, RAG_MIN_SIMILARITY } from 'rag-extract/retrieval';
import type { VectorHit } from 'rag-extract/vector';
export { applySimilarityFloor, RAG_MIN_SIMILARITY };
export declare function logSimilarityScores(candidates: ReadonlyArray<VectorHit>, kept: ReadonlyArray<VectorHit>, log?: LoggerInterface | null): void;
