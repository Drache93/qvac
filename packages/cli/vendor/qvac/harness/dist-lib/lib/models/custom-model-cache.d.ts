import type { CustomModelEntry } from './model-catalog.ts';
export interface CustomDownloads {
    readonly files: ReadonlyArray<string>;
    readonly dirs: ReadonlyArray<string>;
}
export declare function customFileCachePath(src: string, modelsDir: string | undefined): string | null;
export interface CustomShardCache {
    readonly dir: string;
    readonly files: ReadonlyArray<string>;
}
export declare function customShardCache(src: string, modelsDir: string | undefined): CustomShardCache | null;
export declare function customDownloads(entry: CustomModelEntry, modelsDir: string | undefined): Promise<CustomDownloads>;
export declare function isCustomModelCached(entry: CustomModelEntry, modelsDir: string | undefined): Promise<boolean>;
