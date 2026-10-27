import type { QvacKnowledgeArtifact } from '../../../../spec/mesh/hyperschema/types.d.ts';
export interface ProcessorArtifactKey {
    readonly processorId: string;
    readonly hash: string;
}
export declare function processorArtifactId({ processorId, hash }: ProcessorArtifactKey): string;
export declare function isProcessorArtifactId(id: string): boolean;
export declare function isProcessorOutput(version: string): boolean;
export declare function assertArtifactOutput(output: Pick<QvacKnowledgeArtifact, 'embedderVersion' | 'dimensions' | 'artifactBlobId'>): void;
