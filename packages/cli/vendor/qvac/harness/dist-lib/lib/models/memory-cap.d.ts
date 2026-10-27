export declare const VictimRank: {
    readonly generator: 0;
    readonly companion: 1;
    readonly requested: 2;
    readonly pinned: 3;
    readonly replying: 4;
};
export interface CapVictim {
    readonly rank: number;
    readonly lastUsed: number;
}
export declare function nextVictim<T extends CapVictim>(victims: ReadonlyArray<T>): T | undefined;
export declare function memoryCapBytes(percent: number, availableBytes: number): number;
