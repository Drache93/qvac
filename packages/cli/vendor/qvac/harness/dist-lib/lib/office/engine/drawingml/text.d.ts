import type { Element } from '../xml.ts';
export interface Paragraph {
    text: string;
    level?: number;
}
export type TextInput = string | (string | Paragraph)[];
export type Alignment = 'left' | 'center' | 'right' | 'justify';
export interface Style {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    font?: string;
    align?: Alignment;
}
export interface ReadParagraph {
    text: string;
    level: number;
}
export interface Losses {
    hyperlinks?: number;
    fields?: number;
}
export interface StyleTarget {
    paragraph?: number;
}
export declare function readParagraphs(txBody: Element): ReadParagraph[];
export declare function readText(txBody: Element): string;
export declare function normalizeParagraphs(input: unknown): Paragraph[];
export declare function losses(txBody: Element): Losses;
export declare function writeParagraphs(txBody: Element, input: unknown): number;
export declare function ensureTextBody(parent: Element, order?: readonly string[]): Element;
export declare function validateStyle(style: unknown): Style;
export declare function applyStyle(txBody: Element, input: unknown, target?: StyleTarget): number;
