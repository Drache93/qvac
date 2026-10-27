import type { MusicClamps, MusicModelStages } from '../../lib/models/model-catalog.ts';
import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
export { audioDurationSeconds, backendDevice, backendName, CPU_FALLBACK_NOTICE, createGenerateMusicTool, createMusicRuntime, gpuFallback, musicPercentTick, pcmToWav, presentStats, type GeneratedAudio, type MusicGenSdk, type MusicRuntime, type MusicRuntimeOptions, type MusicStats, type MusicTick } from './generate-music.ts';
export interface MusicOptions {
    model: MusicModelStages & {
        inferenceSteps?: number;
        useGpu?: boolean;
    };
    clamps?: MusicClamps;
    read?: readonly string[];
}
export declare class Music implements HarnessPlugin {
    readonly name = "music";
    readonly api = 1;
    readonly needs: string[];
    readonly addons: {
        'audiogen-ggml': () => Promise<any>;
    };
    readonly read: readonly string[] | undefined;
    private readonly _options;
    constructor(options: MusicOptions);
    validate(): string | null;
    setup(ctx: PluginContext): PluginSetup;
}
