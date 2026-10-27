import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type { QvacAgentHost, QvacAppendChunkOperation, QvacChunk, QvacChunkContentModelRequest, QvacDevice } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { RouterContext } from './types.ts';
export type ModelRequestChunk = QvacChunk & {
    modelRequest: QvacChunkContentModelRequest;
};
export declare function asModelRequest(chunk: QvacChunk | null): ModelRequestChunk | null;
export declare function ownerSigner(tx: HyperDB, request: QvacChunk, writerKey: Buffer): Promise<QvacDevice | null>;
export declare function hostForWriter(db: HyperDB, writerKey: Buffer): Promise<QvacAgentHost | null>;
export declare function takerFor(tx: HyperDB, request: ModelRequestChunk, writerKey: Buffer): Promise<Buffer | null>;
export declare function takenBySigner(tx: HyperDB, request: ModelRequestChunk, writerKey: Buffer): Promise<boolean>;
export declare function appendRow(tx: HyperDB, row: Omit<QvacChunk, 'seq'>): Promise<QvacChunk>;
export declare function roundChunkRefusal(op: QvacAppendChunkOperation, { tx, node }: RouterContext): Promise<string | null>;
export declare function openRound(op: QvacAppendChunkOperation): QvacAppendChunkOperation;
export declare function outputRefusal(op: QvacAppendChunkOperation, request: ModelRequestChunk, { tx, node }: RouterContext): Promise<string | null>;
export declare function served(request: ModelRequestChunk, at: number): ModelRequestChunk;
export interface EndedRun {
    readonly chatId: string;
    readonly runId: string;
    readonly at: number;
}
export declare function closeRounds(tx: HyperDB, { chatId, runId, at }: EndedRun): Promise<void>;
export declare function hostOutputRefusal(op: QvacAppendChunkOperation, round: ModelRequestChunk | null, { tx, node }: RouterContext): Promise<string | null>;
export declare function modelOutputOnly(router: Router): Router;
export declare function registerModelRequestRoutes(router: Router): void;
