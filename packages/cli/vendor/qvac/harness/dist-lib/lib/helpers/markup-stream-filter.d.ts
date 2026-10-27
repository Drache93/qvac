export interface MarkupStreamFilterOptions {
    readonly onToolCall?: (body: string) => void;
}
export interface MarkupStreamFilter {
    readonly push: (token: string) => string;
    readonly flush: () => string;
}
export declare function createMarkupStreamFilter(options?: MarkupStreamFilterOptions): MarkupStreamFilter;
