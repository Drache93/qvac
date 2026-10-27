import type { VectorIdWire, VectorIndexStorage } from '../schemas/index.js';
/**
 * Snapshot paths are used as given when absolute. A relative path resolves
 * against the QVAC data directory (the parent of the configured cache
 * directory), the same root that holds the RAG workspace stores, so the
 * same relative path works on every platform.
 */
export declare function resolveVectorIndexPath(snapshotPath: string): string;
export declare function createVectorIndex(params: {
    dim: number;
    storage: VectorIndexStorage;
}): {
    indexId: string;
    dim: number;
    storage: VectorIndexStorage;
    length: number;
};
export declare function loadVectorIndex(params: {
    path: string;
}): {
    storage?: VectorIndexStorage;
    indexId: string;
    dim: number;
    length: number;
};
export declare function addVectors(params: {
    indexId: string;
    ids: VectorIdWire[];
    vectors: number[][];
}): {
    length: number;
};
export declare function searchVectors(params: {
    indexId: string;
    queries: number[][];
    k: number;
}): {
    results: {
        id: string;
        score: number;
    }[][];
};
/**
 * Removes ids one at a time, which is the only shape the backend offers. A
 * backend throw here means the handle itself is unusable, so the batch stops
 * rather than trying the rest — but ids before it are already gone, so the
 * error names how many were applied. `length` is only reported on success,
 * which is why the handle documents its own `length` as of the last call that
 * reported one.
 */
export declare function removeVectors(params: {
    indexId: string;
    ids: VectorIdWire[];
}): {
    removed: boolean[];
    length: number;
};
export declare function containsVectors(params: {
    indexId: string;
    ids: VectorIdWire[];
}): {
    present: boolean[];
};
export declare function writeVectorIndex(params: {
    indexId: string;
    path: string;
}): Promise<{
    path: string;
}>;
export declare function disposeVectorIndex(params: {
    indexId: string;
}): {
    disposed: boolean;
};
export declare function getOpenVectorIndexCount(): number;
export declare function disposeAllVectorIndexes(): void;
