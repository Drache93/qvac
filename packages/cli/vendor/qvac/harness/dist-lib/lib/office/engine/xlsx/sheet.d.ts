import type { Document, Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
import { type SharedStrings } from './strings.ts';
import type { Styles } from './styles.ts';
import type { Area, Position } from './refs.ts';
export type CellValue = string | number | boolean | null;
export interface EditState {
    touched: Set<Sheet>;
    formulas: boolean;
    cellsChanged: boolean;
}
export interface SheetHost {
    package: Package;
    strings: SharedStrings;
    styles: Styles;
    state: EditState;
    readonly date1904: boolean;
}
export interface SheetEntry {
    el: Element;
    index: number;
    rId: string;
    name: string;
    state: string;
    part: string;
    kind: string;
}
export interface CellEntry extends Position {
    el: Element;
}
export interface RowEntry {
    el: Element;
    r: number;
}
export interface ReadOptions {
    range?: string;
    limit?: number;
}
export interface SheetRead {
    name: string;
    range: string | null;
    rows: CellValue[][];
    formulas: Record<string, string>;
    merged: string[];
    truncated?: boolean;
}
export interface CellRead {
    value: CellValue;
    formula: string | null;
    format: string;
}
export interface SerialDate {
    serial: number;
    time: boolean;
}
export interface ColumnWidth {
    col: number;
    width: number;
}
export declare const SHEET_ORDER: string[];
export declare function serialToIso(serial: number, date1904: boolean): string | number;
export declare function isoToSerial(value: string, date1904: boolean): SerialDate;
export declare class Sheet {
    host: SheetHost;
    name: string;
    part: string;
    index: number;
    private masters;
    constructor(host: SheetHost, entry: SheetEntry);
    get package(): Package;
    get doc(): Document;
    get root(): Element;
    sheetData(): Element;
    rows(): Element[];
    touch(): void;
    cells(): CellEntry[];
    numberedRows(): RowEntry[];
    numberedCells(row: Element, r: number): CellEntry[];
    number(): void;
    positionOf(c: Element): Position;
    usedRange(): Area | null;
    merged(): string[];
    value(c: Element): CellValue;
    formula(c: Element): string | null;
    resetMasters(): void;
    read(opts?: ReadOptions): SheetRead;
    get(ref: unknown): CellRead;
    findRow(r: number): Element | null;
    ensureRow(r: number): Element;
    findCell(pos: Position): Element | null;
    ensureCell(pos: Position): Element;
    write(ref: string, input: unknown): void;
    lastRow(): number;
    shiftRows(from: number, delta: number): void;
    removeRows(from: number, count: number): void;
    removeColumns(from: number, count: number): void;
    setColumnWidth(spec: ColumnWidth): void;
    updateDimension(): void;
    private position;
    private sharedMasters;
    private fillRead;
    private appendValue;
    private writeContent;
    private writeValue;
    private shrinkColumns;
    private guardMerged;
    private guardWrite;
}
