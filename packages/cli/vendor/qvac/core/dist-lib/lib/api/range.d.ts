import type { Bounds } from '../core/range.ts';
interface WireBounds {
    gt?: number | null;
    gte?: number | null;
    lt?: number | null;
    lte?: number | null;
    reverse?: boolean | null;
    limit?: number | null;
}
export declare function bounds({ gt, gte, lt, lte, reverse, limit }: WireBounds): Bounds;
export {};
