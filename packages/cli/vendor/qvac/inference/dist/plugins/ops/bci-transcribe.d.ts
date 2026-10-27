import { type BciStreamOpts, type BciTranscribeParams, type TranscribeSegment, type TranscribeStats } from '../../schemas/index.js';
import Buffer from 'bare-buffer';
import { type StreamResult } from '../../profiling/model-execution.js';
import type { InferenceBackendDiagnostics } from '../../schemas/index.js';
type BciTranscribeReturn = {
    modelExecutionMs: number;
    stats?: TranscribeStats;
    diagnostics?: InferenceBackendDiagnostics;
};
export declare function bciTranscribe(params: BciTranscribeParams & {
    metadata: true;
}, requestId?: string): AsyncGenerator<TranscribeSegment, BciTranscribeReturn, void>;
export declare function bciTranscribe(params: BciTranscribeParams, requestId?: string): AsyncGenerator<string, BciTranscribeReturn, void>;
type BciStreamReturn = StreamResult;
export declare function bciTranscribeStream(modelId: string, neuralStream: AsyncIterable<Buffer>, metadata: true, opts?: BciStreamOpts, requestId?: string): AsyncGenerator<TranscribeSegment, BciStreamReturn, void>;
export declare function bciTranscribeStream(modelId: string, neuralStream: AsyncIterable<Buffer>, metadata?: boolean, opts?: BciStreamOpts, requestId?: string): AsyncGenerator<string, BciStreamReturn, void>;
export {};
