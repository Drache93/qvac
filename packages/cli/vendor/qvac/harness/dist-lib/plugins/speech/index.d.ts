import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import { type SpeechOptions } from './speech-engine.ts';
export type { SpeechDialogue, SpeechOptions, SpeechSpeaker, TtsEngine } from './speech-engine.ts';
export declare class Speech implements HarnessPlugin {
    readonly name = "speech";
    readonly api = 1;
    readonly provides: string[];
    readonly needs: string[];
    readonly addons: {
        'tts-ggml': () => Promise<typeof import("@qvac/tts-ggml/addonLogging")>;
        'asr-ggml': () => Promise<typeof import("@qvac/asr-ggml/addonLogging")>;
        'bare-ffmpeg': () => Promise<typeof import("#audio-transcode")>;
    };
    private readonly _options;
    constructor(options?: SpeechOptions);
    validate(): string | null;
    setup(ctx: PluginContext): PluginSetup;
}
