export type Dispose = () => void | Promise<void>;
export declare class Scope {
    private readonly _name;
    private readonly _disposers;
    private readonly _releases;
    private _sealed;
    private _disposed;
    private _closing;
    constructor(name: string);
    assertOpen(): void;
    assertActive(): void;
    onDispose(dispose: Dispose): void;
    onRelease(dispose: Dispose): void;
    seal(): void;
    close(): Promise<void>;
    private _dispose;
}
