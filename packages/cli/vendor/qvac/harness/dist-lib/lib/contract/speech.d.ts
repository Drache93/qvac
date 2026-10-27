import type { TextToSpeechStreamClientParams, TextToSpeechStreamSession } from '@qvac/inference';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CapabilityProfile } from '../models/model-catalog-constants.ts';
export type TtsStreamSession = TextToSpeechStreamSession;
export interface TranscribeStreamSegment {
    text: string;
    append: boolean;
    startMs?: number;
    endMs?: number;
    id?: number;
}
export interface TranscribeStreamEvent {
    type: 'text' | 'segment' | 'vad' | 'endOfTurn';
    text?: string;
    segment?: TranscribeStreamSegment;
}
export interface TranscribeStreamSession {
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TranscribeStreamEvent>;
}
export interface VoiceSdk {
    transcribe(params: {
        modelId: string;
        audioChunk: Buffer;
    }): Promise<string>;
    transcribeStream(params: {
        modelId: string;
        metadata?: boolean;
        parakeetStreamingConfig?: {
            chunkMs?: number;
            emitPartials?: boolean;
        };
    }): Promise<TranscribeStreamSession>;
    textToSpeech(params: {
        modelId: string;
        text: string;
        inputType: 'text';
        stream: boolean;
    }): {
        bufferStream: AsyncGenerator<number>;
        buffer: Promise<number[]>;
        done: Promise<boolean>;
        sampleRate: Promise<number | undefined>;
    };
    textToSpeechStream(params: TextToSpeechStreamClientParams): Promise<TtsStreamSession>;
    cancel(params: {
        modelId: string;
        operation?: 'inference';
    }): Promise<unknown>;
}
export interface TranscribeContext {
    model: string;
    audio: Buffer;
    signal?: BareAbortSignal;
}
export interface SpeakContext {
    model: string;
    text: string;
    signal?: BareAbortSignal;
}
export interface SpeakStreamContext {
    model: string;
    text: AsyncIterable<string>;
    signal?: BareAbortSignal;
}
export interface SpeakResult {
    audio: Buffer;
    sampleRate: number;
}
export interface SpeechService {
    defaultModel(profile: CapabilityProfile | null): string;
    transcribe(context: TranscribeContext): Promise<string>;
    speak(context: SpeakContext): Promise<SpeakResult>;
    speakStream(context: SpeakStreamContext): AsyncIterable<SpeakResult>;
}
