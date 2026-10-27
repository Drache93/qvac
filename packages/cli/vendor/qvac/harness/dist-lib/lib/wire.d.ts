import type { HarnessEvent } from './contract-types.ts';
import type { KnowledgeArtifact, KnowledgeHit, KnowledgeStatus, KnowledgeUpsertResult } from './contract/knowledge.ts';
import type { HarnessKnowledgeHit, HarnessKnowledgeStatusResponse, HarnessKnowledgeUpsertRequest, HarnessKnowledgeUpsertResponse } from '../spec/hyperschema/types.d.ts';
import type { ModelRoundEvent, ModelRoundRequest, ModelRoundResult } from './capabilities/completion-engine/index.ts';
export interface WireEvent {
    runId?: string | null;
    round?: number | null;
    replacedTypes?: string[] | null;
    type: string;
    text?: string | null;
    name?: string | null;
    arguments?: unknown;
    result?: unknown;
    callId?: string | null;
    resource?: {
        kind: string;
        label: string;
    } | null;
    message?: string | null;
    metrics?: unknown;
    path?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    raw?: boolean | null;
    attachmentId?: string | null;
    meta?: boolean | null;
    byteLength?: number | null;
    percentage?: number | null;
    cleared?: boolean | null;
    query?: string | null;
    limit?: number | null;
    question?: string | null;
    options?: unknown;
    effect?: string | null;
    op?: string | null;
    payload?: unknown;
    decision?: string | null;
    rawCall?: string | null;
    intent?: string | null;
    display?: unknown;
}
export interface RoundFailureWire {
    message: string;
    payload: {
        name: string;
        code?: string | number | undefined;
    };
}
export interface WireDownloadEvent {
    type: string;
    downloaded?: boolean | null;
    progress?: unknown;
    assetId?: string | null;
    message?: string | null;
}
export declare function isPlainWireValue(value: unknown): boolean;
export declare function redactedRecoveryFields(source: Record<string, unknown>): Record<string, unknown>;
export declare function toWire(event: HarnessEvent): WireEvent;
export declare function fromWire(event: WireEvent): HarnessEvent;
export declare function roundFailureWire(err: unknown): RoundFailureWire;
export declare function roundFailureFrom(wire: Pick<WireEvent, 'message' | 'payload'>): Error;
export declare function roundRequestFrom(payload: unknown): ModelRoundRequest;
export declare function roundResultFrom(wire: Pick<WireEvent, 'message' | 'payload' | 'result'>): ModelRoundResult;
export declare function roundChunkFrom(payload: unknown): ModelRoundEvent;
export declare function toDownloadWire(event: HarnessEvent): WireDownloadEvent;
export declare function fromDownloadWire(event: WireDownloadEvent): HarnessEvent;
export interface PackedVectors {
    dimensions: number;
    vectors: Buffer;
}
export declare function packVectors(vectors: number[][]): PackedVectors;
export declare function unpackVectors(dimensions: number, bytes: Buffer): number[][];
export declare function toKnowledgeUpsertWire(artifact: KnowledgeArtifact): HarnessKnowledgeUpsertRequest;
export declare function fromKnowledgeUpsertWire(wire: HarnessKnowledgeUpsertRequest): KnowledgeArtifact;
export declare function toKnowledgeUpsertResultWire(result: KnowledgeUpsertResult): HarnessKnowledgeUpsertResponse;
export declare function fromKnowledgeUpsertResultWire(wire: HarnessKnowledgeUpsertResponse, chunks: number): KnowledgeUpsertResult;
export declare function fromKnowledgeHitWire({ metadata, ...hit }: HarnessKnowledgeHit): KnowledgeHit;
export declare function fromKnowledgeStatusWire(wire: HarnessKnowledgeStatusResponse): KnowledgeStatus;
