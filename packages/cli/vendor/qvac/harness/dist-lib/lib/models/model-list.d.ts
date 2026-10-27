import type * as QvacSdk from '@qvac/inference';
import { type ModelAddon, type ModelRegistrySdk } from './model-source.ts';
import { type ModelTaskType } from './model-task.ts';
import type { ModelFitBasis, ModelFitEvidence, ModelFitVerdict } from './model-fit.ts';
export type ModelType = ModelAddon;
export interface StaticCatalogEntry {
    readonly name: string;
    readonly registryPath: string;
}
export type ModelListSdk = ModelRegistrySdk & Pick<typeof QvacSdk, 'getModelInfo'> & {
    readonly models: ReadonlyArray<StaticCatalogEntry>;
};
export interface ModelInfo {
    name: string;
    type: ModelType;
    registryPath: string;
    registrySource: string;
    isCached: boolean;
    isLoaded: boolean;
    isLoading: boolean;
    supportsImages: boolean;
    expectedSize: number;
    actualSize?: number;
    memoryBytes?: number;
    label?: string;
    taskType: ModelTaskType;
    fit?: ModelFitVerdict;
    fitBasis?: ModelFitBasis;
    fitEvidence?: ModelFitEvidence;
}
export type CatalogRow = Omit<ModelInfo, 'isLoading'>;
export interface ListModelsOptions {
    type?: ModelType;
    cachedOnly?: boolean;
    fullRegistry?: boolean;
}
interface ModelStatus {
    at: number;
    isCached: boolean;
    isLoaded: boolean;
    expectedSize?: number;
    actualSize?: number;
}
export interface ModelStatusCache {
    readonly entries: Map<string, ModelStatus>;
    epoch: number;
}
export declare const MODEL_STATUS_TTL_MS = 30000;
export declare function createModelStatusCache(): ModelStatusCache;
export declare function invalidateModelStatusCache(cache: ModelStatusCache): void;
export interface ListModelsRuntime {
    cache?: ModelStatusCache | undefined;
    projectionFor?: ((name: string) => string | undefined) | undefined;
}
export declare function listModels(sdk: ModelListSdk, { type, cachedOnly, fullRegistry }?: ListModelsOptions, { cache, projectionFor }?: ListModelsRuntime): Promise<CatalogRow[]>;
export interface CustomModelRowsContext {
    readonly modelsDir?: string;
    readonly loaded: ReadonlySet<string>;
}
export declare function customModelRows({ type, cachedOnly }: ListModelsOptions, { modelsDir, loaded }: CustomModelRowsContext): Promise<CatalogRow[]>;
export declare function mergeCustomRows(catalog: ReadonlyArray<CatalogRow>, custom: ReadonlyArray<CatalogRow>): CatalogRow[];
export interface ModelSourceQuery {
    readonly model: string;
    readonly addon: ModelAddon;
    readonly modelsDir: string | undefined;
}
export declare function isModelSourceCached(sdk: ModelListSdk, { model, addon, modelsDir }: ModelSourceQuery): Promise<boolean>;
export {};
