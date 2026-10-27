import type { HandlerFrames } from '../../../spec/capabilities.d.ts';
export interface UploadInputOptions {
    readonly inactivityMs?: number;
}
export declare class UploadInput<T extends {
    data?: Buffer | null;
}> {
    readonly iterator: AsyncIterator<T>;
    private readonly _abort;
    private readonly _frames;
    private readonly _source;
    private readonly _onClose;
    onData: ((bytes: number) => void) | null;
    onFailure: ((error: unknown) => void) | null;
    constructor(frames: AsyncIterable<T> | HandlerFrames<T>, options: UploadInputOptions);
    check(): void;
    fail(error: unknown): void;
    close(): void;
}
