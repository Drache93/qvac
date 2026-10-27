import { type TranscribeClientParams, type RPCOptions, type TranscribeSegment, type TranscribeStreamRequest, type TranscribeStreamClientParams, type TranscribeStreamSession, type TranscribeStreamMetadataSession, type TranscribeStreamConversationSession, type TranscribeStreamEvent, type TranscribeStats, type InferenceBackendDiagnostics } from '@qvac/inference/surface';
import { stream, duplex } from '../rpc/rpc-client.js';
type TranscribeDuplexFactory = (request: TranscribeStreamRequest, options?: RPCOptions) => ReturnType<typeof duplex>;
/**
 * Transcribe audio and return the complete text. Accepts either a file
 * path or an audio buffer.
 *
 * @param params - Transcription parameters.
 * @param params.modelId - The identifier of the transcription model to use
 * @param params.audioChunk - Audio input as either a file path (string) or audio buffer
 * @param params.prompt - Optional initial prompt to guide the transcription
 * @param params.metadata - When true, resolves to an array of transcript
 *                          segments (`{ text, startMs, endMs, append, id }`,
 *                          plus `isEndOfTurn` and `startsWord` on parakeet)
 *                          instead of joined text.
 * @param options - Optional RPC options including per-call profiling
 * @returns A promise (decorated with `requestId`) resolving to the
 *          complete transcribed text, or — when `metadata` is true —
 *          the list of transcript segments in emission order. The
 *          `requestId` is reachable synchronously so callers can target
 *          this in-flight transcription with `cancel({ requestId })`
 *          before `await` resolves. `stats` resolves to the terminal engine
 *          statistics, including Parakeet's per-run Core ML usage.
 */
type TranscribeCall<T> = Promise<T> & {
    requestId: string;
    stats: Promise<TranscribeStats | undefined>;
};
export declare function transcribe(params: TranscribeClientParams & {
    metadata: true;
}, options?: RPCOptions): TranscribeCall<TranscribeSegment[]>;
export declare function transcribe(params: TranscribeClientParams, options?: RPCOptions): TranscribeCall<string>;
export declare function createTranscribeCall(params: TranscribeClientParams, options?: RPCOptions, responseStream?: typeof stream): TranscribeCall<string | TranscribeSegment[]>;
/**
 * @deprecated Pass audio via `transcribe()` instead. This overload will be
 * removed in the next major version.
 *
 * Streaming transcription with upfront audio: sends full audio, yields text
 * chunks as they arrive.
 *
 * @overloadLabel "Upfront audio (deprecated)"
 * @param params - Transcription parameters including audio source.
 * @param options - Optional RPC options including per-call profiling.
 * @returns An async generator yielding text chunks as they become available.
 */
export declare function transcribeStream(params: TranscribeClientParams & {
    metadata: true;
}, options?: RPCOptions): AsyncGenerator<TranscribeSegment>;
export declare function transcribeStream(params: TranscribeClientParams, options?: RPCOptions): AsyncGenerator<string>;
/**
 * Opens a bidirectional streaming transcription session. Audio is streamed
 * in via `write()`, and transcription text is yielded as the model's VAD
 * detects complete speech segments.
 *
 * The returned session is single-use. Attempting to iterate a second
 * time will throw a `TranscriptionFailedError`.
 *
 * @overloadLabel "Bidirectional session"
 * @param params - Streaming transcription parameters.
 * @param params.modelId - The loaded transcription model to use
 * @param params.prompt - Optional initial prompt to guide transcription
 * @param params.metadata - When true, the session yields transcript segment
 *                          objects (`{ text, startMs, endMs, append, id }`,
 *                          plus `isEndOfTurn` and `startsWord` on parakeet)
 *                          instead of plain text.
 * @param options - Optional RPC options including per-call profiling.
 * @returns A session object: call `write(audioChunk)` with a `Uint8Array`
 *          (Node `Buffer` is a `Uint8Array` subtype) to feed audio,
 *          iterate with `for await (...)` to receive transcription, and
 *          `end()` to signal end of audio. After consuming the iterator,
 *          await `session.stats` for terminal engine statistics.
 */
export declare function transcribeStream(params: TranscribeStreamClientParams & {
    emitVadEvents: true;
}, options?: RPCOptions): Promise<TranscribeStreamConversationSession>;
export declare function transcribeStream(params: TranscribeStreamClientParams & {
    parakeetStreamingConfig: NonNullable<TranscribeStreamClientParams['parakeetStreamingConfig']>;
}, options?: RPCOptions): Promise<TranscribeStreamConversationSession>;
export declare function transcribeStream(params: TranscribeStreamClientParams & {
    metadata: true;
}, options?: RPCOptions): Promise<TranscribeStreamMetadataSession>;
export declare function transcribeStream(params: TranscribeStreamClientParams, options?: RPCOptions): Promise<TranscribeStreamSession>;
/**
 * Shared duplex session factory. The per-call line processor decides whether
 * to surface strings or segments; `sessionName` is only used to label the
 * "already iterated" error so callers see the correct session type.
 */
export declare function createTranscribeStreamSession<T>(params: TranscribeStreamClientParams, options: RPCOptions | undefined, process: (line: string, onTerminal: (stats: TranscribeStats | undefined, diagnostics: InferenceBackendDiagnostics | undefined) => void) => T | undefined | null, sessionName: string, duplexFactory?: TranscribeDuplexFactory): Promise<{
    stats: Promise<TranscribeStats | undefined>;
    diagnostics: Promise<InferenceBackendDiagnostics | undefined>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<T>;
}>;
export declare function processLine(line: string, onTerminal: (stats: TranscribeStats | undefined, diagnostics: InferenceBackendDiagnostics | undefined) => void): string | undefined | null;
export declare function processLineConversation(line: string, wantsMetadata: boolean, onTerminal: (stats: TranscribeStats | undefined, diagnostics: InferenceBackendDiagnostics | undefined) => void): TranscribeStreamEvent | undefined | null;
export {};
//# sourceMappingURL=transcribe.d.ts.map