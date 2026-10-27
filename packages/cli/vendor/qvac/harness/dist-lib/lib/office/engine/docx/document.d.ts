import { Package } from '../opc/package.ts';
import { Styles, type FormattedStyle } from './styles.ts';
import * as template from './template.ts';
import type { OpenOptions } from '../opc/package.ts';
import type { SaveOptions } from '../opc/properties.ts';
import type { ChartInfo, ChartData, ChartSpec, DataResult, Changed } from '../drawingml/chart.ts';
import type { TextInput } from '../drawingml/text.ts';
import type { Alignment, Format, ParagraphSpec, Removed, Run } from './text.ts';
export type { Alignment, Format, ParagraphSpec, Removed, Run };
export type { CreateOptions } from './template.ts';
export type TextSpec = string | ParagraphSpec;
export type Paragraphs = TextSpec | TextSpec[];
export interface ReadOptions {
    from?: number;
    count?: number;
}
export interface ParagraphBlock {
    index: number;
    type: 'paragraph';
    style: string;
    text: string;
    heading?: number;
    list?: boolean;
    level?: number;
    footnotes?: string[];
    comments?: string[];
    images?: number;
    charts?: ChartInfo[];
    pageBreak?: boolean;
}
export interface TableBlock {
    index: number;
    type: 'table';
    rows: string[][];
}
export interface OtherBlock {
    index: number;
    type: 'other';
    text: string;
}
export type Block = ParagraphBlock | TableBlock | OtherBlock;
export interface Note {
    id: string;
    text: string;
}
export interface Comment {
    id: string;
    author: string | null;
    text: string;
}
export interface ReadResult {
    total: number;
    blocks: Block[];
    headers: string[];
    footers: string[];
    footnotes: Note[];
    comments: Comment[];
}
export interface TextResult {
    changed: boolean;
    removed?: Removed;
}
export interface InsertResult {
    index: number;
    count: number;
}
export interface DeleteOptions {
    count?: number;
}
export interface BlocksResult {
    blocks: number;
}
export interface Section {
    index: number;
    level: number;
    title: string;
    end: number;
}
export interface SectionOptions {
    title?: TextSpec;
    body?: Paragraphs;
}
export interface SectionResult {
    index: number;
    removed: number;
    added: number;
}
export interface TableOptions {
    rows: (string | number | null)[][];
    header?: boolean;
    style?: string;
}
export interface TableResult {
    index: number;
    rows: number;
    columns: number;
}
export interface CellRef {
    table: number;
    row: number;
    column: number;
}
export interface RowRef {
    table: number;
    row: number;
}
export interface RowOptions {
    at?: number;
}
export interface RowsResult {
    rows: number;
}
export interface ImageOptions {
    width?: number;
    height?: number;
    description?: string;
    name?: string;
    align?: Alignment;
}
export interface Size {
    width: number;
    height: number;
}
export interface Placed extends Size {
    index: number;
}
export interface DocChartSpec extends ChartSpec {
    width?: number;
    height?: number;
    name?: string;
}
export interface ChartOptions {
    chart?: number;
}
export interface HeaderOptions {
    type?: 'default' | 'first';
}
export interface HeaderResult {
    changed: boolean;
    parts?: number;
}
export declare class Document {
    package: Package;
    main: string;
    styles: Styles;
    private orphans;
    constructor(pkg: Package);
    static open(bytes: Uint8Array | ArrayBuffer, opts?: OpenOptions): Document;
    static create(opts?: template.CreateOptions): Document;
    get changed(): boolean;
    get blockCount(): number;
    read(opts?: ReadOptions): ReadResult;
    setHeader(value: Paragraphs | null, opts?: HeaderOptions): HeaderResult;
    setFooter(value: Paragraphs | null, opts?: HeaderOptions): HeaderResult;
    paragraphStyles(): string[];
    setText(index: number, input: TextSpec): TextResult;
    insertParagraphs(at: number, specs: Paragraphs): InsertResult;
    appendParagraphs(specs: Paragraphs): InsertResult;
    deleteBlocks(index: number, opts?: DeleteOptions): BlocksResult;
    sections(): Section[];
    replaceSection(index: number, opts?: SectionOptions): SectionResult;
    deleteSection(index: number): BlocksResult;
    formatParagraph(index: number, input: Format): Changed;
    format(index: number, input: Format): Changed;
    formatStyle(name: string, input: Format): FormattedStyle;
    addTable(at: number, opts: TableOptions): TableResult;
    setCell(cell: CellRef, input: TextSpec): TextResult;
    addRow(table: number, values: (string | number | null)[], opts?: RowOptions): RowsResult;
    deleteRow(ref: RowRef): RowsResult;
    addImage(at: number, bytes: Uint8Array, opts?: ImageOptions): Placed;
    addChart(at: number, spec: DocChartSpec): Placed;
    setChartData(index: number, data: ChartData, opts?: ChartOptions): DataResult;
    setChartTitle(index: number, title: TextInput | null, opts?: ChartOptions): Changed;
    save(opts?: SaveOptions): Uint8Array;
    private doc;
    private unreferenced;
    private dropOrphaned;
    private body;
    private sectPr;
    private blocks;
    private touch;
    private block;
    private paragraph;
    private table;
    private cell;
    private anchor;
    private place;
    private position;
    private specs;
    private build;
    private setLevel;
    private sectionList;
    private setHeaderFooter;
    private headerParts;
    private createHeaderPart;
    private fillHeaderPart;
    private notes;
    private comments;
    private templateBefore;
    private blankOnly;
    private ensureTrailingParagraph;
    private styleIdOf;
    private headingLevel;
    private isList;
    private heading;
    private sectionEnd;
    private describe;
    private chartParts;
    private chartPart;
    private partTexts;
    private textWidth;
    private imageSize;
    private nextDocPrId;
    private tableStyleId;
    private tableElement;
}
