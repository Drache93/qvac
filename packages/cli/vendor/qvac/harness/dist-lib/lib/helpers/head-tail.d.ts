export interface Ends {
    readonly head: string;
    readonly tail: string;
    readonly total: number;
}
export declare function headTail(text: string, limit: number): string;
export declare function joinHeadTail(ends: Ends, limit: number, locator?: string | null): string;
