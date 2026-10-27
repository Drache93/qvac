export declare class LogBuffer<T> {
    private readonly _items;
    private readonly _cap;
    constructor(cap: number);
    push(item: T): void;
    snapshot(): ReadonlyArray<T>;
}
