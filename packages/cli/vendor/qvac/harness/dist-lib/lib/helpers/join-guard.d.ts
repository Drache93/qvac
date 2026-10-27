export interface JoinGuard {
    readonly push: (text: string) => string;
    readonly cut: () => void;
    readonly flush: () => string;
}
export declare function createJoinGuard(markers: readonly string[]): JoinGuard;
