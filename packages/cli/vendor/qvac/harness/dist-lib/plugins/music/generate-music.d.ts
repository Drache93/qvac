import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { MusicSettings, ToolDefinition, ToolExecuteContext } from '../../lib/contract/index.ts';
import type { ModelSrc } from '../../lib/models/context.ts';
import { type MusicClamps, type MusicModelStages } from '../../lib/models/model-catalog.ts';
import type { ModelHost, TrackedLoad } from '../../lib/contract/models.ts';
import type { HoldFn } from '../../lib/contract/models.ts';
import { type ModelRegistrySdk } from '../../lib/models/model-source.ts';
export declare const MAX_DURATION_SECONDS = 300;
export declare const MIN_DURATION_SECONDS = 1;
export declare const MAX_STEPS = 60;
export interface MusicTick {
    stage: string;
    step: number;
    total: number;
}
export interface GeneratedAudio {
    pcm: Uint8Array;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
}
export interface MusicStats {
    audioDurationMs?: number;
    totalTimeMs?: number;
    realTimeFactor?: number;
    backendDevice?: number;
    backendId?: number;
}
interface AudioGenRun {
    requestId: string;
    progressStream: AsyncGenerator<MusicTick>;
    audio: Promise<GeneratedAudio>;
    stats: Promise<MusicStats | undefined>;
}
export interface AudioGenParams {
    caption: string;
    lyrics?: string;
    duration?: number;
    seed?: number;
    bpm?: number;
    keyscale?: string;
    timesignature?: string;
    vocalLanguage?: string;
}
export interface AudioGenModelConfig {
    textEncModelSrc: ModelSrc;
    lmModelSrc: ModelSrc;
    ditModelSrc: ModelSrc;
    vaeModelSrc: ModelSrc;
    useGPU?: boolean;
    inferenceSteps?: number;
}
export type MusicGenSdk = ModelRegistrySdk & {
    loadModel(params: {
        modelType: 'audiogen';
        modelConfig: AudioGenModelConfig;
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
    unloadModel(params: {
        modelId: string;
    }): Promise<unknown>;
    audioGen(params: AudioGenParams & {
        modelId: string;
    }): AudioGenRun;
    cancel?(params: {
        requestId: string;
    }): Promise<void>;
};
export interface MusicRuntimeOptions extends MusicModelStages {
    loadSdk: () => Promise<MusicGenSdk>;
    inferenceSteps?: number;
    useGpu?: boolean;
    onProgress?: (model: string, progress: Record<string, unknown>) => void;
    onBeforeLoad?: (signal: BareAbortSignal | undefined, srcs: ReadonlyArray<string>) => Promise<void>;
    hold?: HoldFn;
    loads?: Pick<ModelHost, 'track'>;
}
export interface LoadedMusicModel {
    modelId: string;
}
export interface EnsureMusicLoadedOptions {
    readonly signal?: BareAbortSignal;
    readonly modelChoice?: string;
    readonly inferenceSteps?: number;
}
export interface MusicRuntime {
    loadSdk: () => Promise<MusicGenSdk>;
    gpuRequested: boolean;
    defaultSteps?: number;
    ensureLoaded: (sdk: MusicGenSdk, options?: EnsureMusicLoadedOptions) => Promise<LoadedMusicModel>;
    unload(): Promise<void>;
    unloadIdle(): Promise<void>;
    acquire(): boolean;
    release(): void;
}
export declare function musicPercentTick(onPercent: (percentage: number) => void): (tick: MusicTick) => void;
export declare function createMusicRuntime({ loadSdk, onProgress, onBeforeLoad, hold, loads, inferenceSteps: baseSteps, useGpu, ...base }: MusicRuntimeOptions): MusicRuntime;
export declare const BUSY_ERROR = "a music generation is already running; try again when it finishes";
export interface MusicToolError {
    error: string;
}
export interface GeneratedTrack extends GeneratedAudio {
    stats?: MusicStats;
}
export interface RunAudioGenOptions {
    readonly modelId: string;
    readonly params: AudioGenParams;
    readonly signal?: BareAbortSignal;
    readonly onTick?: (tick: MusicTick) => void;
}
export declare function runAudioGen(sdk: MusicGenSdk, { modelId, params, signal, onTick }: RunAudioGenOptions): Promise<GeneratedTrack | MusicToolError>;
export declare function audioDurationSeconds(audio: GeneratedAudio): number;
export declare function presentStats(stats: MusicStats | undefined): MusicStats | undefined;
export declare const CPU_FALLBACK_NOTICE = "The GPU was unavailable, so this track was generated on the CPU and took much longer than usual.";
export interface GpuFallbackOptions {
    gpuRequested: boolean;
    stats: MusicStats | undefined;
}
export declare function gpuFallback({ gpuRequested, stats }: GpuFallbackOptions): boolean;
export declare function backendDevice(stats: MusicStats | undefined): 'gpu' | 'cpu' | 'unknown';
export declare function backendName(backendId: number | undefined): string;
export declare function pcmToWav(audio: GeneratedAudio): Uint8Array;
export declare function settingsDuration(value: number | undefined, maxDuration: number): number | undefined;
export declare function settingsSteps(value: number | undefined, maxSteps?: number): number | undefined;
export declare function normalizeClamps(clamps?: MusicClamps): Required<MusicClamps>;
export declare function resolveMusicSettings(ctx: ToolExecuteContext | undefined): MusicSettings;
export declare function createGenerateMusicTool(runtime: MusicRuntime, clamps?: MusicClamps): ToolDefinition;
export {};
