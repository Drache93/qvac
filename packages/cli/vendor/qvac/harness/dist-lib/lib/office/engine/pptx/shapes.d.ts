import type { Document, Element } from '../xml.ts';
import type { Box } from './inherit.ts';
export type ShapeKind = 'text' | 'shape' | 'picture' | 'group' | 'connector' | 'table' | 'chart' | 'diagram' | 'frame';
export interface ShapeEntry {
    el: Element;
    id: number | null;
    name: string;
    kind: ShapeKind;
    placeholder: string | null;
    group: number | null;
}
export type Cell = string | number | null;
export interface PictureFrame {
    id: number;
    rId: string;
    box: Box;
    name?: string;
    description?: string;
}
export interface TextBoxFrame {
    id: number;
    box: Box;
    text?: unknown;
    style?: unknown;
    fill?: unknown;
    name?: string;
}
export interface TableFrame {
    id: number;
    box: Box;
    rows: unknown;
    header?: boolean;
    name?: string;
    tableStyle: string;
}
export interface ChartFrame {
    id: number;
    box: Box;
    rId: string;
    name?: string;
}
export declare const SHAPE_ORDER: string[];
export declare function shapesOf(doc: Document): ShapeEntry[];
export declare function placeholderFrom(doc: Document, source: ShapeEntry, id: number): Element;
export declare function pictureElement(doc: Document, frame: PictureFrame): Element;
export declare function nextShapeId(doc: Document): number;
export declare function validateColor(color: unknown, name?: string): string;
export declare function textBoxElement(doc: Document, frame: TextBoxFrame): Element;
export declare function validateRows(rows: unknown): Cell[][];
export declare function tableElement(doc: Document, frame: TableFrame): Element;
export declare function chartFrameElement(doc: Document, frame: ChartFrame): Element;
export declare function setBackground(doc: Document, color: unknown): void;
