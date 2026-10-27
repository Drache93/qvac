import ResourcePuddle from 'resource-puddle';
import { ModelHandle } from './model-handle.ts';
import { type ModelSrc } from './context.ts';
import type { CpuPlacement } from '../hardware/cpu-placement.ts';
import { type ModelAddon } from './model-source.ts';
import type { GpuFaultState } from './sdk-faults.ts';
import type { LoadedModelInfo } from '@qvac/inference';
import type { LoadedModel } from '../contract-types.ts';
import type { HoldFn } from './download-gate.ts';
type SdkModule = typeof import('@qvac/inference');
type FitModelType = NonNullable<import('@qvac/inference').AssessModelFitInput['models'][number]['modelType']>;
export interface FitProbeSdk {
    getLoadedModelInfo?(params: {
        modelId: string;
    }): Promise<Pick<LoadedModelInfo, 'fitProbe'>>;
}
export interface ModelState {
    status: 'held' | 'loading' | 'downloading' | 'downloaded' | 'ready' | 'error' | 'unloading' | 'unloaded';
    model: string;
    catalogChanged?: boolean;
    [key: string]: unknown;
}
export type NotifyFn = (state: ModelState) => void;
export declare class ModelUnloadError extends Error {
    constructor(cause: unknown);
}
export interface LlamaLoadKnobs {
    threads?: number;
    'batch-size'?: number;
    'ubatch-size'?: number;
    'kv-offload'?: false;
    'n-cpu-moe'?: number;
}
export interface PendingLoad {
    readonly key: string;
    readonly model: string;
    readonly modelSrc: ModelSrc;
    readonly modelType: FitModelType;
    readonly modelConfig?: Record<string, unknown> | undefined;
}
export interface Admission {
    readonly bytes: number | undefined;
    release(): void;
}
export type BeforeLoad = (load: PendingLoad) => Promise<Admission | undefined>;
export type ChooseContext = (load: PendingLoad, tier: number) => Promise<number>;
export interface LlmDeviceConfig {
    device?: 'cpu' | 'gpu';
    gpuLayers?: number;
    contextSize?: number;
    kvCacheK?: string;
    kvCacheV?: string;
    mainGpu?: () => Promise<string | undefined>;
    openclCacheDir?: () => string | undefined;
    llama?: LlamaLoadKnobs;
    slots?: number;
    contextFor?: (key: string) => number | undefined;
    slotsFor?: (key: string) => number | undefined;
    cpuPlacement?: () => CpuPlacement | undefined;
}
export type TrackedLoad = Promise<string> & {
    requestId?: string;
};
export interface CancelSdk {
    cancel(params: {
        requestId: string;
    }): Promise<unknown>;
}
export interface LoadTracker {
    readonly draining: boolean;
    track(pending: TrackedLoad, sdk?: Partial<CancelSdk>): TrackedLoad;
    drain(sdk?: Partial<CancelSdk>): void;
    undrain(): void;
}
export declare function createLoadTracker(): LoadTracker;
export type ModelLifecycleSdk = Pick<SdkModule, 'unloadModel' | 'modelRegistrySearch'> & Partial<CancelSdk> & FitProbeSdk & {
    loadModel(params: {
        modelSrc: ModelSrc;
        modelType: 'llamacpp-completion';
        modelConfig?: LlamaLoadKnobs & {
            verbosity?: 0 | 1 | 2 | 3;
            system_prompt?: string;
            tools?: boolean;
            stop_sequences?: readonly string[];
            ctx_size?: number;
            parallel?: number;
            'cache-type-k'?: string;
            'cache-type-v'?: string;
            projectionModelSrc?: ModelSrc;
            device?: 'cpu' | 'gpu';
            gpu_layers?: number;
            'main-gpu'?: string;
            openclCacheDir?: string;
            threads?: number;
            'cpu-mask'?: string;
        };
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
};
export interface ModelLoadOptions {
    ctxSize?: number;
    kvCacheK?: string;
    kvCacheV?: string;
    projectionModel?: string;
    llama?: LlamaLoadKnobs;
    slots?: number;
}
export declare function resolveLoadOptions(opts?: ModelLoadOptions, deviceConfig?: LlmDeviceConfig): ModelLoadOptions;
export declare function modelKey(model: string, opts?: ModelLoadOptions): string;
interface PuddleEntry {
    readonly id: string;
    readonly refs: number;
    readonly value: ModelHandle;
}
declare class ModelPuddle extends ResourcePuddle<string, ModelHandle> {
    readonly resources: Map<string, PuddleEntry>;
}
export type PoolLike = ModelPuddle;
export declare function modelOf(key: string): string;
export declare function releaseModel(pool: PoolLike, key: string): void;
export declare function loadedModels(pool: PoolLike): LoadedModel[];
export declare function settledModels(pool: PoolLike): string[];
export interface SettledEntry {
    readonly key: string;
    readonly refs: number;
    readonly bytes: number | undefined;
    readonly lastUsed: number;
}
export declare function settledEntries(pool: PoolLike): SettledEntry[];
export declare function loadingModels(pool: PoolLike): string[];
export interface ResidentLease {
    model: string;
    modelId: string;
    release: () => void;
}
export declare function leaseResidentModel(pool: PoolLike, wanted?: (model: string) => boolean): Promise<ResidentLease | null>;
export declare function isResident(pool: PoolLike, key: string): boolean;
export declare function leaseCount(pool: PoolLike, key: string): number;
export declare function evictIdle(pool: PoolLike): Promise<void>;
export declare function evictIdleWhere(pool: PoolLike, wanted: (key: string) => boolean): Promise<void>;
export interface DeadlineOptions {
    deadlineMs: number;
    tickMs?: number;
}
export interface ModelCapacityOptions extends DeadlineOptions {
    cap: number;
    signal?: {
        aborted?: boolean;
    } | undefined;
    evictable?: (key: string) => boolean;
}
export declare function awaitModelCapacity(pool: PoolLike, { cap, deadlineMs, tickMs, signal, evictable }: ModelCapacityOptions): Promise<boolean>;
export declare function evictModelWithin(pool: PoolLike, key: string, options: DeadlineOptions): Promise<boolean>;
export declare function evictIdleWithin(pool: PoolLike, key: string, { deadlineMs }: DeadlineOptions): Promise<boolean>;
export declare function evictModel(pool: PoolLike, model: string, options: DeadlineOptions): Promise<boolean>;
export type LoadSdk = () => Promise<ModelLifecycleSdk>;
export type EmbedLifecycleSdk = Pick<SdkModule, 'unloadModel' | 'modelRegistrySearch'> & Partial<CancelSdk> & FitProbeSdk & {
    loadModel(params: {
        modelSrc: ModelSrc;
        modelType: 'llamacpp-embedding';
        modelConfig?: {
            batchSize?: number;
            gpuLayers?: number;
            device?: string;
            openclCacheDir?: string;
        };
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
};
export type LoadEmbedSdk = () => Promise<EmbedLifecycleSdk>;
export declare function progressState(model: string, progress: Record<string, unknown>): ModelState;
interface LoadClockGuardOptions {
    now?: () => number;
    monoMs?: () => number;
    sampleMs?: number;
    jumpMs?: number;
}
interface LoadClockGuard {
    race: (pending: TrackedLoad) => Promise<string>;
}
export declare function loadClockGuard(model: string, sdk: Partial<CancelSdk>, { now, monoMs, sampleMs, jumpMs }?: LoadClockGuardOptions): LoadClockGuard;
export interface ResolvedLoad {
    opts: ModelLoadOptions;
    deviceConfig: LlmDeviceConfig;
}
export declare function slotCount(model: string, { opts, deviceConfig }: ResolvedLoad): number;
export declare function contextSize(model: string, modelSrc: ModelSrc, { opts, deviceConfig }: ResolvedLoad): number;
export declare function resolveCtxSize(loadSdk: LoadSdk, model: string, load: ResolvedLoad): Promise<number>;
type UnloadFailureFn = (modelId: string, error: unknown) => void;
export interface ModelPoolOptions {
    deviceConfig?: LlmDeviceConfig;
    loads?: LoadTracker;
    onUnloadFailure?: UnloadFailureFn | undefined;
    beforeLoad?: BeforeLoad;
    chooseContext?: ChooseContext;
    hold?: HoldFn;
}
export declare function createModelPool(loadSdk: LoadSdk, notify: NotifyFn, { deviceConfig, loads, onUnloadFailure, beforeLoad, chooseContext, hold }?: ModelPoolOptions): ModelPuddle;
export interface EmbedPoolOptions {
    faults: GpuFaultState;
    batchSize?: number;
    openclCacheDir?: (() => string | undefined) | undefined;
    loads?: LoadTracker;
    onUnloadFailure?: UnloadFailureFn | undefined;
    beforeLoad?: BeforeLoad;
    hold?: HoldFn;
}
export declare function createEmbedPool(loadSdk: LoadEmbedSdk, notify: NotifyFn, { faults, batchSize, openclCacheDir, loads, onUnloadFailure, beforeLoad, hold }: EmbedPoolOptions): ModelPuddle;
export type VoiceLifecycleSdk = Pick<SdkModule, 'unloadModel' | 'modelRegistrySearch'> & Partial<CancelSdk> & FitProbeSdk & {
    loadModel(params: {
        modelSrc: ModelSrc;
        modelType: string;
        modelConfig?: Record<string, unknown>;
        onProgress?: (progress: Record<string, unknown>) => void;
    }): TrackedLoad;
};
export type LoadVoiceSdk = () => Promise<VoiceLifecycleSdk>;
export interface VoicePoolOptions {
    modelType: FitModelType;
    addon: ModelAddon;
    modelConfig?: Record<string, unknown> | undefined;
    modelConfigFor?: (modelSrc: ModelSrc) => Readonly<Record<string, unknown>> | undefined;
    openclCacheDir?: (() => string | undefined) | undefined;
    loads?: LoadTracker;
    onUnloadFailure?: UnloadFailureFn | undefined;
    beforeLoad?: BeforeLoad;
    hold?: HoldFn;
}
export declare function createVoicePool(loadSdk: LoadVoiceSdk, notify: NotifyFn, { modelType, addon, modelConfig, modelConfigFor, openclCacheDir, loads, onUnloadFailure, beforeLoad, hold }: VoicePoolOptions): ModelPuddle;
export {};
