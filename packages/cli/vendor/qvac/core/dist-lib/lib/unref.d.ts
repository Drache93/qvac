export interface UnrefableTimer {
    unref?: () => void;
}
export declare function unref(timer: UnrefableTimer | number): void;
