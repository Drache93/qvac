import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export interface EmbedSdk {
    embed(params: {
        modelId: string;
        text: string[];
    }): Promise<{
        embedding: number[][];
    }>;
}
export interface EmbedArgs {
    modelId: string;
    texts: string[];
}
export interface EmbedContext {
    model: string;
    texts: string[];
    signal?: BareAbortSignal;
}
export type EmbedLane = (sdk: EmbedSdk, args: EmbedArgs) => Promise<number[][]>;
export declare function createEmbedLane(): EmbedLane;
