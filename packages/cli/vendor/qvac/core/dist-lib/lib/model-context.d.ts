export declare const MOBILE_CONTEXT_SIZE = 12288;
export declare const MODEL_CONTEXT_TARGET: {
    readonly desktop: 'desktop';
    readonly mobile: 'mobile';
};
export type ModelContextTarget = (typeof MODEL_CONTEXT_TARGET)[keyof typeof MODEL_CONTEXT_TARGET];
export declare function modelContextTargetForPlatform(platform: string | null | undefined): ModelContextTarget | null;
export declare const DEFAULT_CONTEXT_SIZE = 8192;
export declare const COMPACTION_MIN_CTX_SIZE = 4096;
export interface ModelContextOptions {
    readonly custom?: {
        readonly contextLength?: number;
    } | null;
}
export declare function maxContextForModel(modelName: string, opts?: ModelContextOptions): number;
export declare function defaultContextForModel(modelName: string, target?: ModelContextTarget, opts?: ModelContextOptions): number;
export declare function formatTokenCount(n: number): string;
export declare function contextOptionsForModel(modelName: string, target?: ModelContextTarget, opts?: ModelContextOptions): ReadonlyArray<number>;
