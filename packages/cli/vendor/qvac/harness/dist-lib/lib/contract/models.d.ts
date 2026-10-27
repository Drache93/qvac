import type { createVectorIndex, loadVectorIndex } from '@qvac/inference';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ModelSrc } from '../models/context.ts';
import type { HoldFn } from '../models/download-gate.ts';
import type { CancelSdk, ModelState, PendingLoad, TrackedLoad } from '../models/model-pool.ts';
export type { CancelSdk, HoldFn, ModelState, TrackedLoad };
export interface ModelHost {
    sdk(): Promise<unknown>;
    track(load: TrackedLoad, sdk?: Partial<CancelSdk>): TrackedLoad;
    makeRoom(signal: BareAbortSignal | undefined, busy: string | Error, srcs?: ReadonlyArray<string>): Promise<void>;
    hold: HoldFn;
    completionModel(model: string, signal?: BareAbortSignal): Promise<BorrowedModel>;
    emit(state: ModelState): void;
    progressState(model: string, progress: Record<string, unknown>): ModelState;
    statusChanged(): void;
    readonly transcriptionDevice?: 'cpu' | 'gpu' | undefined;
    registerPool(spec: ResidentPoolSpec): ResidentPool;
    enterWork(): () => void;
}
export interface BorrowedModel {
    modelId: string;
    release(): void;
}
export interface ResidentPoolSpec {
    addon: 'tts' | 'parakeet';
    modelType: PendingLoad['modelType'];
    modelConfig?: Record<string, unknown>;
    modelConfigFor?: (modelSrc: ModelSrc) => Readonly<Record<string, unknown>> | undefined;
    openclCache?: boolean;
    label?: string;
    needsRoom?: (model: string) => boolean;
    sdk(): Promise<unknown>;
}
export interface PooledModel {
    load(): Promise<{
        modelId: string;
    }>;
    peek(): Promise<unknown> | null;
    release(): void;
}
export interface ResidentPool {
    open(model: string): PooledModel;
    resident(model: string): boolean;
    evictIdle(wanted: (model: string) => boolean): Promise<void>;
}
export interface EmbedRequest {
    model: string;
    texts: string[];
    signal?: BareAbortSignal;
}
export interface VectorIndexSdk {
    createVectorIndex: typeof createVectorIndex;
    loadVectorIndex: typeof loadVectorIndex;
}
export interface EmbedHost {
    embed(request: EmbedRequest): Promise<number[][]>;
    sdk(): Promise<VectorIndexSdk>;
}
