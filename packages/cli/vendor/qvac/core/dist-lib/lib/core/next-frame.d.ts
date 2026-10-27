import type { AbortSignal } from 'bare-abort-controller';
export declare const UPLOAD_INACTIVITY_MS = 30000;
export interface NextFrameOptions {
    readonly signal?: AbortSignal;
    readonly inactivityMs?: number;
}
export declare function nextFrame<T>(iterator: AsyncIterator<T>, { signal, inactivityMs }?: NextFrameOptions): Promise<IteratorResult<T>>;
