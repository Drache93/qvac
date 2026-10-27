export declare const STEP = 1000;
export interface Placement<T> {
    rank: number;
    respaced: Array<{
        row: T;
        rank: number;
    }>;
}
export declare function rankBetween(anchor: number, next: number | undefined): number;
export declare function rankOnTop(top: number | undefined, now: number): number;
export interface PlaceOptions {
    readonly at: number;
    readonly now: number;
}
export declare function place<T>(siblings: readonly T[], keyOf: (row: T) => number, { at, now }: PlaceOptions): Placement<T>;
