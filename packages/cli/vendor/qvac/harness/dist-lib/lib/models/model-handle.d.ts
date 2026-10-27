import { type AbortSignal } from 'bare-abort-controller';
import type { LoadFit } from '../contract-types.ts';
export interface ModelResource {
    model: string;
    modelId: string;
    ctxSize?: number;
    slots?: number;
    fit?: LoadFit | undefined;
    bytes?: number;
}
export interface ModelHandleOptions {
    load(signal: AbortSignal): Promise<ModelResource>;
    onLoaded?(): void;
    onFailed?(err: unknown): void;
}
export declare class ModelHandle {
    private readonly _load;
    private readonly _peek;
    private readonly _onLoaded;
    private readonly _onFailed;
    private _tracked;
    private _loading;
    private _resource;
    lastUsed: number;
    private _attempt;
    constructor({ load, onLoaded, onFailed }: ModelHandleOptions);
    load(): Promise<ModelResource>;
    get loading(): boolean;
    abandon(): void;
    peek(): Promise<ModelResource> | null;
    get resource(): ModelResource | null;
}
