export interface Position {
    row: number;
    col: number;
}
export interface Area {
    top: number;
    left: number;
    bottom: number;
    right: number;
}
export declare const MAX_ROWS = 1048576;
export declare const MAX_COLUMNS = 16384;
export declare function column(index: number): string;
export declare function columnIndex(letters: string): number;
export declare function cell(row: number, col: number): string;
export declare function parse(ref: unknown): Position;
export declare function parseRange(ref: unknown): Area;
export declare function range(area: Area): string;
export declare function quoteSheet(name: string): string;
export declare function absolute(sheet: string, area: Area): string;
export declare function columnArg(value: unknown): number;
export declare function rowArg(value: unknown, name?: string): number;
