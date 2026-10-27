import { type TranscribeParams, type TranscribeSegment, type TranscribeStats, type TranscribeStreamEvent, type ParakeetStreamingRunConfig } from '../../schemas/index.js';
import type Buffer from 'bare-buffer';
import type { InferenceBackendDiagnostics } from '../../schemas/index.js';
import { assertMetadataSupported, toTranscribeSegment, type AsrAddonSegment } from '../../utils/transcribe-metadata.js';
export { assertMetadataSupported, toTranscribeSegment, type AsrAddonSegment };
type TranscribeReturn = {
    modelExecutionMs: number;
    stats?: TranscribeStats;
    diagnostics?: InferenceBackendDiagnostics;
};
export declare function transcribe(params: TranscribeParams & {
    metadata: true;
}, requestId?: string): AsyncGenerator<TranscribeSegment, TranscribeReturn, void>;
export declare function transcribe(params: TranscribeParams, requestId?: string): AsyncGenerator<string, TranscribeReturn, void>;
export interface TranscribeStreamOpts {
    emitVadEvents?: boolean;
    endOfTurnSilenceMs?: number;
    vadRunIntervalMs?: number;
    parakeetStreamingConfig?: ParakeetStreamingRunConfig;
}
export declare function transcribeStream(modelId: string, audioInputStream: AsyncIterable<Buffer>, prompt: string | undefined, metadata: true, opts?: TranscribeStreamOpts, requestId?: string): AsyncGenerator<TranscribeSegment | TranscribeStreamEvent, TranscribeReturn, void>;
export declare function transcribeStream(modelId: string, audioInputStream: AsyncIterable<Buffer>, prompt?: string, metadata?: boolean, opts?: TranscribeStreamOpts, requestId?: string): AsyncGenerator<string | TranscribeStreamEvent, TranscribeReturn, void>;
