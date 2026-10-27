export interface Bounds {
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    reverse?: boolean;
    limit?: number;
}
interface Range<Key> {
    gt?: Key;
    gte?: Key;
    lt?: Key;
    lte?: Key;
    reverse?: boolean;
    limit?: number;
}
export declare function keyRange<Key extends object>(prefix: Partial<Key>, field: keyof Key & string, { gt, gte, lt, lte, reverse, limit }?: Bounds): Range<Partial<Key>>;
export {};
