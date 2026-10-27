import type { Document, Element } from '../xml.ts';
export type Alignment = 'left' | 'center' | 'right' | 'justify';
export interface RunFormat {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    color?: string;
    font?: string;
}
export interface Format extends RunFormat {
    align?: Alignment;
}
export interface Run extends RunFormat {
    text: string;
}
export interface ParagraphSpec {
    text?: string;
    runs?: (string | Run)[];
    style?: string;
    styleId?: string;
    align?: Alignment;
    pageBreak?: boolean;
    level?: number;
}
export interface Removed {
    hyperlinks?: number;
    images?: number;
    fields?: number;
    contentControls?: number;
    equations?: number;
    objects?: number;
    breaks?: number;
}
export type WAttributes = Record<string, string | number | undefined | null>;
export declare const W: "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export declare const RUN_ORDER: string[];
export declare const PARAGRAPH_ORDER: string[];
export declare const ALIGNMENTS: Record<Alignment, string>;
export declare const FORMAT_KEYS: readonly string[];
export declare const RUN_KEYS: readonly string[];
export declare function wGet(el: Element | null, name: string): string;
export declare function paragraphText(el: Element): string;
export declare function blockText(el: Element): string;
export declare function hasPageBreak(p: Element): boolean;
export declare function wAttr(el: Element, name: string, value: string | number): void;
export declare function wEl(doc: Document, local: string, attributes?: WAttributes): Element;
export declare function validateFormat(format: unknown, known?: readonly string[]): Format;
export declare function applyRunFormat(rPr: Element, format: RunFormat): void;
export declare function ensure(parent: Element, local: string, order?: readonly string[]): Element;
export declare function setAlign(p: Element, align: Alignment): void;
export declare function normalizeRuns(input: unknown): Run[];
export declare function assertUntracked(p: Element, where: string): void;
export declare function replaceContent(p: Element, input: unknown): Removed;
export declare function buildParagraph(doc: Document, input: unknown, template: Element | null): Element;
