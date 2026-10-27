import { type EmbedContext } from '../capabilities/embed.ts';
import type { Lifecycle } from '../lifecycle/index.ts';
import type { HoldFn } from '../models/download-gate.ts';
import { type EmbedDevice } from '../models/embed-config.ts';
import { type FitAssessment, type FitQuery } from '../models/model-fit.ts';
import { createEmbedPool, type BeforeLoad, type LoadTracker, type ModelState } from '../models/model-pool.ts';
import type { SdkLoader } from '../sdk-loader.ts';
export type EmbedPool = ReturnType<typeof createEmbedPool>;
export type EmbeddingsGate = Pick<Lifecycle, 'suspended' | 'opened' | 'ready' | 'enterWork' | 'assertNotClosing' | 'recordPoolCleanupFailure' | 'recordModelUnloadFailure'>;
export interface EmbeddingsOptions {
    device?: EmbedDevice | undefined;
    gpuLayers?: number | undefined;
    batchSize?: number | undefined;
    sdk: Pick<SdkLoader, 'loadEmbed'>;
    loads: LoadTracker;
    gate: EmbeddingsGate;
    notify(state: ModelState): void;
    settleFit(query: FitQuery): Promise<FitAssessment | null>;
    evictIdleChat(): Promise<void>;
    beforeLoad?: BeforeLoad | undefined;
    hold?: HoldFn | undefined;
}
export interface EmbedTarget {
    readonly pool: EmbedPool;
    readonly key: string;
    readonly modelType: 'llamacpp-embedding';
    open(): ReturnType<EmbedPool['open']>;
}
export interface RoomTarget {
    readonly pool: unknown;
    readonly key: string;
}
export declare class Embeddings {
    private readonly _sdk;
    private readonly _loads;
    private readonly _gate;
    private readonly _notify;
    private readonly _settleFit;
    private readonly _evictIdleChat;
    private readonly _beforeLoad;
    private readonly _hold;
    private _embedModels;
    private readonly _retiredEmbedModels;
    private readonly _faultedEmbedKeys;
    private readonly _embedLane;
    private _embedFaults;
    private readonly _embedGpuLayers?;
    private readonly _embedBatchSize;
    private _embedControl;
    constructor(opts: EmbeddingsOptions);
    get pool(): EmbedPool;
    get device(): EmbedDevice;
    pools(): EmbedPool[];
    target(model: string): EmbedTarget;
    recreate(): void;
    evictIdle(): Array<Promise<unknown>>;
    setDevice(device: EmbedDevice): Promise<void>;
    makeRoom(model: string, { pool, key }: RoomTarget): Promise<void>;
    destroy(): Promise<void>;
    embed({ model, texts, signal }: EmbedContext): Promise<number[][]>;
    private _createEmbedPool;
    private _collectRetiredEmbedPool;
    private _releaseEmbedResource;
    private _releaseEmbedResourceBeforeWork;
    private _markEmbedFault;
    private _releaseEmbedResourceAfter;
    private _enqueueEmbedControl;
    private _setEmbeddingDevice;
}
