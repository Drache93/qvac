import { type TranscribeSegment } from '../schemas/index.js';
/**
 * A native transcript segment, as emitted by the engines of
 * `@qvac/asr-ggml` and by `@qvac/bci-whispercpp`. `text` plus the timing
 * fields are shared; `isEndOfTurn` and `startsWord` are parakeet-only, and
 * `windowStartTimestep` is BCI delta-streaming-only.
 */
export interface AsrAddonSegment {
    text: string;
    speakerId?: number;
    speaker?: string;
    speakerSegments?: {
        speakerId: number;
        start: number;
        end: number;
    }[];
    start?: number;
    end?: number;
    toAppend?: boolean;
    id?: number;
    /** Parakeet: the segment ends on a recognized end-of-utterance boundary. */
    isEndOfTurn?: boolean;
    /** Parakeet: the segment begins a new SentencePiece word. */
    startsWord?: boolean;
    /** BCI delta streaming: absolute timestep at which the owning window began. */
    windowStartTimestep?: number;
}
/**
 * Normalize a native transcript segment to the engine-level
 * `TranscribeSegment` shape exposed to callers: seconds → milliseconds,
 * `toAppend` → `append`, and defaults for optional fields. The
 * engine-specific fields are carried through only when the engine sent them,
 * so a segment does not gain fields whose value would be meaningless.
 */
export declare function toTranscribeSegment(chunk: AsrAddonSegment): TranscribeSegment & {
    windowStartTimestep?: number;
};
/**
 * Guard used by transcription ops when the caller opts into `metadata: true`.
 */
export declare function assertMetadataSupported(modelId: string, engineType: string, metadata: boolean | undefined): void;
