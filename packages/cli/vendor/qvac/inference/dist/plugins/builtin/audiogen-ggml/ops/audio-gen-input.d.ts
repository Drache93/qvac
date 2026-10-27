import { type AudioGenAudioInput } from '../../../../schemas/audio-gen.js';
import type { Logger } from '../../../../logging/index.js';
export type AudioGenAudioInputName = 'referenceAudio' | 'sourceAudio';
/**
 * Resolve a reference/source audio input into the interleaved stereo 48 kHz
 * Float32 PCM the ACE-Step engine consumes.
 *
 * - `base64` inputs (client `Buffer`/`Uint8Array`) must already be raw
 *   interleaved stereo 48 kHz Float32 LE PCM; they are handed over as-is
 *   (a copy is made only when the bytes are not 4-byte aligned).
 * - `filePath` inputs with a decodable extension (`.wav`, `.mp3`, `.m4a`,
 *   `.ogg`, `.flac`, `.aac`) are decoded through the SDK's FFmpeg decoder to
 *   48 kHz mono float PCM and duplicated onto both channels. Any other
 *   extension is streamed in as raw interleaved stereo 48 kHz Float32 LE PCM.
 *
 * Every path is bounded by `AUDIOGEN_INPUT_MAX_SECONDS` and rejects
 * non-finite samples, so malformed or oversized input fails with
 * `InvalidAudioInputError` before the engine is invoked.
 *
 * `requireNormalized` additionally holds samples to `[-1, 1]`. Only the edit
 * path needs it — the addon vets an edit source with `requireNormalizedPcm`
 * and everything else with `requireFinitePcm`, which takes any finite sample.
 * It applies to decoded files as much as to raw PCM: decoding does not
 * normalize, so a loud source comes back above 1.0 either way.
 */
export declare function resolveAudioGenPcm(input: AudioGenAudioInput, name: AudioGenAudioInputName, { requireNormalized }?: {
    requireNormalized?: boolean;
}): Promise<Float32Array>;
export interface AudioGenAudioInputs {
    referenceAudio?: AudioGenAudioInput | undefined;
    sourceAudio?: AudioGenAudioInput | undefined;
}
export interface ResolvedAudioGenInputs {
    referenceAudio: Float32Array | undefined;
    sourceAudio: Float32Array | undefined;
}
export interface ResolveAudioGenInputsOptions {
    modelId: string;
    logger: Logger;
    /** Hold the source to `[-1, 1]`, which only an edit requires; a reference never is. */
    normalizedSource?: boolean;
}
/**
 * Decode a run's reference and source audio concurrently. When both fail, the
 * source's failure is thrown and the reference's is logged, so neither
 * diagnostic is lost. A request that always carries a source (an edit) gets
 * it back decoded.
 */
export declare function resolveAudioGenInputs(inputs: AudioGenAudioInputs & {
    sourceAudio: AudioGenAudioInput;
}, options: ResolveAudioGenInputsOptions): Promise<ResolvedAudioGenInputs & {
    sourceAudio: Float32Array;
}>;
export declare function resolveAudioGenInputs(inputs: AudioGenAudioInputs, options: ResolveAudioGenInputsOptions): Promise<ResolvedAudioGenInputs>;
