import type { TtsStats } from '../schemas/index.js';
import type { TtsStats as AddonTtsStats, TtsOutputChunk } from './addon-responses.js';
/**
 * Shared types and utilities for TTS operations.
 * Used by both text-to-speech.ts and text-to-speech-stream.ts.
 */
export type TtsStreamChunk = TtsOutputChunk;
export type TtsOpYield = {
    text?: string;
    buffer: number[];
    sampleRate?: number;
    chunkIndex?: number;
    sentenceChunk?: string;
    isLast?: boolean;
};
/**
 * Everything an addon chunk carries beyond its PCM. Shared by both TTS ops so
 * the plain `stream: true` path and the sentence-stream path emit the same
 * shape — they run the same addon chunker, and previously only the latter
 * forwarded the metadata.
 */
export declare function chunkMetadata(chunk: TtsStreamChunk): {
    isLast?: boolean;
    sentenceChunk?: string;
    chunkIndex?: number;
    sampleRate?: number;
};
/**
 * Appends a chunk's samples to `target` in place, which keeps collecting an
 * utterance linear in its length — a natively chunked MOSS run emits dozens of
 * chunks into one buffer.
 */
export declare function appendPcm(target: number[], samples: ArrayLike<number>): void;
export declare function collectTtsStats(response: {
    stats?: AddonTtsStats;
}): TtsStats;
