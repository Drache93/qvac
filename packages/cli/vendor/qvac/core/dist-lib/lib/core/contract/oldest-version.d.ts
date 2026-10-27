interface MaybeInChat {
    readonly chatId?: unknown;
}
interface Versioned {
    version: number;
}
export declare function oldestVersion<T extends MaybeInChat>(row: T): T & Versioned;
export declare function versionedOp(name: string, payload: unknown): unknown;
export {};
