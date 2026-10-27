import type { Document } from '../xml.ts';
import type { Package } from '../opc/package.ts';
export type CellAlign = 'left' | 'center' | 'right' | 'justify';
export interface CellStyle {
    format?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    fill?: string;
    size?: number;
    font?: string;
    align?: CellAlign;
    wrap?: boolean;
}
export declare function isDateCode(code: string): boolean;
export declare function validate(style: unknown): CellStyle;
export declare class Styles {
    package: Package;
    workbookPart: string;
    part: string | null;
    constructor(pkg: Package, workbookPart: string);
    get doc(): Document;
    formatCode(xfIndex: number): string;
    isDate(xfIndex: number): boolean;
    derive(xfIndex: number, input: unknown): number;
    private applyTo;
    private align;
    private ensurePart;
    private touch;
    private xfs;
    private list;
    private code;
    private formatId;
    private font;
    private fill;
    private dedupe;
}
