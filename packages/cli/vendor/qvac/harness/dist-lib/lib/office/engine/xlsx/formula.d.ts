export type RefKind = 'cell' | 'range' | 'columns' | 'rows';
export interface Point {
    col?: number;
    row?: number;
    absCol?: boolean;
    absRow?: boolean;
}
export interface Ref {
    kind: RefKind;
    start: Point;
    end: Point | null;
    length: number;
}
export interface Change {
    sheet: string;
    axis: 'row' | 'col';
    at: number;
    count: number;
    kind: 'insert' | 'delete';
}
export interface RefContext {
    sheet: string | null;
    original: string;
}
export interface Handlers {
    onRef?: (ref: Ref, context: RefContext) => string | null;
    onSheet?: (names: string[], text: string) => string;
    onTable?: (name: string) => void;
}
export interface Rename {
    from: string;
    to: string;
}
export interface Offset {
    rows: number;
    cols: number;
}
export declare function scan(formula: string, handlers?: Handlers): string;
export declare function sheetsIn(formula: string): string[];
export declare function tablesIn(formula: string): string[];
export declare function usesTable(formula: string, table: string): boolean;
export declare function mentions(formula: string, sheet: string): boolean;
export declare function renameSheet(formula: string, rename: Rename): string;
export declare function shift(formula: string, offset: Offset): string;
export declare function moveIndex(i: number, change: Change): number | null;
export declare function moveSpan(span: [number, number], change: Change): [number, number] | null;
export declare function adjust(formula: string, ownSheet: string | null, change: Change): string;
export declare function references(formula: string, ownSheet: string | null, sheet: string): boolean;
export declare function adjustRange(range: string, change: Change): string | null;
