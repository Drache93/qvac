import type { Document } from '../xml.ts';
import type { ShapeEntry } from './shapes.ts';
import type { ReadOptions, ShapeInfo } from './types.ts';
export declare const BODY_TYPES: Set<string>;
export declare function pick(total: number, opts: ReadOptions): (i: number) => boolean;
export declare function layoutName(doc: Document): string;
export declare function layoutType(doc: Document): string;
export declare function hasBody(doc: Document): boolean;
export declare function describe(shape: ShapeEntry): ShapeInfo;
