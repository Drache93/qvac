export declare class ReleaseError extends Error {
    readonly code: string;
    constructor(code: string, message: string, cause?: unknown);
}
export declare function hasCode(error: unknown, ...codes: ReadonlyArray<string>): boolean;
