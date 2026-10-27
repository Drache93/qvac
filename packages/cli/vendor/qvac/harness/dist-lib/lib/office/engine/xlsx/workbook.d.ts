import { Package, type OpenOptions } from '../opc/package.ts';
import { type CellValue, type CellRead, type EditState, type SheetRead, type ReadOptions } from './sheet.ts';
import { SharedStrings } from './strings.ts';
import { Styles, type CellStyle } from './styles.ts';
import { type CreateOptions } from './template.ts';
import type { ChartInfo, ChartType, Legend, Stacking } from '../drawingml/chart.ts';
import type { SaveOptions } from '../opc/properties.ts';
export type SheetRef = string | number;
export type { CellValue, CellRead, SheetRead, ReadOptions, CellStyle, CreateOptions };
export interface CellOptions extends CellStyle {
    value?: CellValue;
    formula?: string;
    date?: string;
}
export type CellInput = CellValue | CellOptions;
export type Cells = Record<string, CellInput>;
export interface InsertRowsOptions {
    at: number;
    rows?: CellInput[][];
    count?: number;
}
export interface DeleteRowsOptions {
    at: number;
    count?: number;
}
export interface DeleteColumnsOptions {
    column: string | number;
    count?: number;
}
export interface ColumnWidthOptions {
    column: string | number;
    width: number;
}
export interface AddSheetOptions {
    at?: number;
}
export interface ImageOptions {
    cell?: string;
    width?: number;
    height?: number;
    name?: string;
    description?: string;
}
export interface SeriesRange {
    values: string;
    name?: string;
    nameCell?: string;
}
export interface SheetChartSpec {
    type: ChartType;
    title?: string;
    stacked?: Stacking;
    legend?: Legend;
    categories: string;
    series: SeriesRange[];
    cell?: string;
    width?: number;
    height?: number;
    name?: string;
}
export interface SheetInfo {
    index: number;
    name: string;
    kind: string;
    state: string;
    range?: string | null;
}
export interface SheetChart extends ChartInfo {
    cell?: string;
}
export interface WorkbookRead extends SheetRead {
    charts?: SheetChart[];
}
export interface Placed {
    cell: string;
    width: number;
    height: number;
}
export interface RowSpan {
    from: number;
    to: number;
}
export interface Changed {
    changed: boolean;
}
export interface Renamed extends Changed {
    formulas?: number;
}
export interface CellCount {
    cells: number;
}
export interface Deleted {
    deleted: number;
}
export interface SheetCount {
    sheets: number;
}
export interface AddedSheet {
    index: number;
    name: string;
}
export declare class Workbook {
    package: Package;
    main: string;
    strings: SharedStrings;
    styles: Styles;
    state: EditState;
    private sheetsChanged;
    constructor(pkg: Package);
    static open(bytes: Uint8Array | ArrayBuffer, opts?: OpenOptions): Workbook;
    static create(opts?: CreateOptions): Workbook;
    get changed(): boolean;
    get date1904(): boolean;
    get hasMacros(): boolean;
    sheets(): SheetInfo[];
    read(sheet: SheetRef, opts?: ReadOptions): WorkbookRead;
    get(sheet: SheetRef, ref: string): CellRead;
    setCells(sheet: SheetRef, cells: Cells): CellCount;
    format(sheet: SheetRef, range: string, style: CellStyle): CellCount;
    appendRows(sheet: SheetRef, rows: CellInput[][]): RowSpan;
    insertRows(sheet: SheetRef, opts: InsertRowsOptions): RowSpan;
    deleteRows(sheet: SheetRef, opts: DeleteRowsOptions): Deleted;
    deleteColumns(sheet: SheetRef, opts: DeleteColumnsOptions): Deleted;
    setColumnWidth(sheet: SheetRef, opts: ColumnWidthOptions): Changed;
    addSheet(name: string, opts?: AddSheetOptions): AddedSheet;
    renameSheet(sheet: SheetRef, name: string): Renamed;
    private renameReferences;
    deleteSheet(sheet: SheetRef): SheetCount;
    addImage(sheet: SheetRef, bytes: Uint8Array, opts?: ImageOptions): Placed;
    addChart(sheet: SheetRef, input: SheetChartSpec): Placed;
    removeMacros(): Changed;
    save(opts?: SaveOptions): Uint8Array;
    private host;
    private reshapeWith;
    private rewriteAll;
    private dropCalcChain;
    private requestRecalc;
    private planSeries;
    private seriesName;
    private placeChart;
    private doc;
    private root;
    private sheetList;
    private entries;
    private entry;
    private sheet;
    private validateName;
    private definedNames;
    private chartParts;
    private formulaUsers;
    private tableUsers;
    private references;
    private writeRows;
    private shiftSheetIndexes;
    private charts;
    private ownCharts;
    private rangeValues;
    private besideData;
    private rowsBelowDrawings;
    private drawingOf;
    private ensureDrawing;
}
