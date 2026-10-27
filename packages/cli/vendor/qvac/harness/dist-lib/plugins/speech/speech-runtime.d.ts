import type { ModelHost } from '../../lib/contract/models.ts';
import type { SpeakContext, SpeakResult, SpeakStreamContext, SpeechService, TranscribeContext } from '../../lib/contract/speech.ts';
import { type CapabilityProfile } from '../../lib/models/model-catalog.ts';
import { type SpeechOptions } from './speech-engine.ts';
export declare class SpeechRuntime implements SpeechService {
    private readonly _models;
    private readonly _options;
    private readonly _loadSdk;
    private readonly _tts;
    private readonly _transcription;
    private readonly _lane;
    constructor(models: ModelHost, options?: SpeechOptions);
    defaultModel(profile: CapabilityProfile | null): string;
    transcribe(context: TranscribeContext): Promise<string>;
    unloadIdle(): Promise<void>;
    speak(context: SpeakContext): Promise<SpeakResult>;
    speakStream({ model, text, signal }: SpeakStreamContext): AsyncIterable<SpeakResult>;
    private _needsRoom;
    private _makeRoom;
    private _open;
    private _voiceJob;
}
