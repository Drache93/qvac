interface RewindOptions {
    readonly carries: string;
    readonly keep: readonly string[];
}
export declare function rewindSpec(root: string, dirs: string[], { carries, keep }: RewindOptions): string[];
export declare function unstageSpec(root: string, dirs: string[]): void;
export declare function resetHrpcIds(hrpcDir: string): void;
export {};
