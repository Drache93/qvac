import type * as QvacSdk from '@qvac/inference';
export type ModelDeleteSdk = Pick<typeof QvacSdk, 'getModelInfo'>;
export interface DeletedModelFile {
    readonly path: string;
    readonly bytes: number;
}
export interface DeleteModelResult {
    readonly name: string;
    readonly removed: ReadonlyArray<DeletedModelFile>;
    readonly freedBytes: number;
}
export interface DeleteModelSummary {
    readonly name: string;
    readonly removed: number;
    readonly freedBytes: number;
}
export declare function summarizeDelete(result: DeleteModelResult): DeleteModelSummary;
export interface DeleteModelOptions {
    readonly modelsDir?: string;
}
export declare function deleteModelFiles(sdk: ModelDeleteSdk, name: string, { modelsDir }?: DeleteModelOptions): Promise<DeleteModelResult>;
