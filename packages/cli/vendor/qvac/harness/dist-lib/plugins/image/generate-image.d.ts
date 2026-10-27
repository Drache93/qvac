import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { ModelSrc } from '../../lib/models/context.ts';
import { type ImageClamps, type ImageModelSet } from '../../lib/models/model-catalog.ts';
import type { ModelHost, TrackedLoad } from '../../lib/contract/models.ts';
import type { HoldFn } from '../../lib/contract/models.ts';
import { type ModelRegistrySdk } from '../../lib/models/model-source.ts';
export declare const MAX_DIM = 1024;
export declare const DIM_STEP = 64;
export declare const MAX_STEPS = 100;
export interface DiffusionTick {
    step: number;
    totalSteps: number;
    elapsedMs: number;
}
interface DiffusionRun {
    progressStream: AsyncGenerator<DiffusionTick>;
    outputs: Promise<Uint8Array[]>;
    stats: Promise<unknown>;
}
export interface DiffusionParams {
    prompt: string;
    vae_tiling?: boolean;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
    negative_prompt?: string;
    init_image?: Uint8Array;
    init_images?: Uint8Array[];
    auto_resize_ref_image?: boolean;
    strength?: number;
    guidance?: number;
    cfg_scale?: number;
}
export interface DiffusionModelConfig {
    prediction?: 'flux2_flow';
    llmModelSrc?: ModelSrc;
    vaeModelSrc?: ModelSrc;
}
export type DiffusionSdk = ModelRegistrySdk & {
    loadModel(params: {
        modelSrc: ModelSrc;
        modelType: 'diffusion';
        modelConfig?: DiffusionModelConfig;
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
    unloadModel(params: {
        modelId: string;
    }): Promise<unknown>;
    diffusion(params: DiffusionParams & {
        modelId: string;
    }): DiffusionRun;
    cancel?(params: {
        operation: 'inference';
        modelId: string;
    } | {
        requestId: string;
    }): Promise<void>;
};
export declare const IMAGE_LOAD_STALL_MS: number;
export interface DiffusionRuntimeOptions extends ImageModelSet {
    loadSdk: () => Promise<DiffusionSdk>;
    onProgress?: (model: string, progress: Record<string, unknown>) => void;
    onLoaded?: (model: string) => void;
    onBeforeLoad?: (signal: BareAbortSignal | undefined, srcs: ReadonlyArray<string>) => Promise<void>;
    hold?: HoldFn;
    loads?: Pick<ModelHost, 'track'>;
    stallMs?: number;
}
export interface LoadedDiffusionModel {
    modelId: string;
    prediction?: 'flux2_flow';
}
export interface DiffusionRuntime {
    loadSdk: () => Promise<DiffusionSdk>;
    ensureLoaded: (sdk: DiffusionSdk, signal?: BareAbortSignal, modelChoice?: string) => Promise<LoadedDiffusionModel>;
    predictionFor(modelChoice?: string): 'flux2_flow' | undefined;
    unload(): Promise<void>;
    unloadIdle(): Promise<void>;
    acquire(): boolean;
    release(): void;
}
export declare function generationPercentTick(onPercent: (percentage: number) => void, encodePhases?: number): (tick: DiffusionTick) => void;
export declare function createDiffusionRuntime({ loadSdk, onProgress, onLoaded, onBeforeLoad, hold, loads, stallMs, ...base }: DiffusionRuntimeOptions): DiffusionRuntime;
export declare const BUSY_ERROR = "an image generation is already running; try again when it finishes";
export interface ImageToolError {
    error: string;
}
export interface RunDiffusionOptions {
    readonly modelId: string;
    readonly params: DiffusionParams;
    readonly signal?: BareAbortSignal;
    readonly onTick?: (tick: DiffusionTick) => void;
}
export declare function runDiffusion(sdk: DiffusionSdk, { modelId, params, signal, onTick }: RunDiffusionOptions): Promise<Uint8Array | ImageToolError>;
export interface CommonImageArgs {
    prompt: string;
    steps?: number;
    seed?: number;
    negativePrompt?: string;
}
export declare function parseCommonArgs(args: Record<string, unknown>, maxSteps?: number): CommonImageArgs | ImageToolError;
export declare function normalizeClamps(clamps?: ImageClamps): Required<ImageClamps>;
export declare function settingsDimension(value: number | undefined, maxDim?: number): number | undefined;
export declare function settingsSteps(value: number | undefined, maxSteps?: number): number | undefined;
export declare function effectiveSteps(parsedSteps: number | undefined, settingsValue: number | undefined, stepsCap: number | undefined): number | undefined;
export declare function createGenerateImageTool(runtime: DiffusionRuntime, clamps?: ImageClamps): ToolDefinition;
export {};
