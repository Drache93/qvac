import { AbortedError } from './engine-error.ts';
export { AbortedError };
export interface AbortSignalLike {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void, options?: {
        once?: boolean;
    }): void;
    removeEventListener(type: 'abort', listener: () => void): void;
}
export declare function raceAbort<T>(promise: Promise<T>, signal?: AbortSignalLike): Promise<T>;
