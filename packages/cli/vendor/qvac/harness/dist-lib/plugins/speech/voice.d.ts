import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { SpeakResult, VoiceSdk } from '../../lib/contract/speech.ts';
import type { TtsEngine } from './speech-engine.ts';
export declare function transcribeOnce(sdk: VoiceSdk, modelId: string, audio: Buffer): Promise<string>;
export interface TranscribeStreamingOptions {
    modelId: string;
    signal?: BareAbortSignal | undefined;
}
export interface TranscribeAudioOptions extends TranscribeStreamingOptions {
    audio: Buffer;
}
export declare function transcribeAudio(sdk: VoiceSdk, pcm: AsyncIterable<Uint8Array>, { modelId, signal, audio }: TranscribeAudioOptions): Promise<string>;
export declare function transcribeStreaming(sdk: VoiceSdk, pcm: AsyncIterable<Uint8Array>, opts: TranscribeStreamingOptions): Promise<string>;
export interface SpeakOptions {
    modelId: string;
    engine?: TtsEngine;
}
export declare function speakStreamOnce(sdk: VoiceSdk, text: AsyncIterable<string>, { modelId, engine }: SpeakOptions): AsyncGenerator<SpeakResult>;
export declare function speakable(text: string, engine?: TtsEngine): string;
export declare function speakOnce(sdk: VoiceSdk, text: string, { modelId, engine }: SpeakOptions): Promise<SpeakResult>;
export declare function packSamples(samples: number[]): Buffer;
