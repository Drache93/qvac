import type { AbortSignal } from 'bare-abort-controller';
import type { QvacKnowledge } from '../../../../spec/mesh/hyperschema/types.d.ts';
import { type RagArtifactPayload, type RagExtractors } from 'rag-extract';
export interface BuildEmbedder {
    model: string;
    embed(input: {
        texts: string[];
        signal?: AbortSignal;
    }): Promise<number[][]>;
    idle?(signal: AbortSignal): Promise<void>;
}
export type BuildProgress = (processedChunks: number, totalChunks: number) => void | Promise<void>;
export declare class EmbedderFailure extends Error {
    constructor(cause: unknown);
}
export interface ArtifactBuildInput {
    embedder: BuildEmbedder;
    knowledge: QvacKnowledge;
    artifactId: string;
    bytes: Buffer;
    signal: AbortSignal;
    onProgress?: BuildProgress;
    onExtracted?: () => void | Promise<void>;
    extractors?: RagExtractors;
}
export declare function yieldTurn(signal: AbortSignal): Promise<void>;
export declare function buildArtifactPayload(input: ArtifactBuildInput): Promise<RagArtifactPayload>;
