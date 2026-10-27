import type { ModelRegistryEntry } from '@qvac/inference';
export type ModelSrc = string | (ModelRegistryEntry & {
    src: string;
});
export declare function defaultContextSize(modelSrc: ModelSrc, trainedContext?: number): number;
