import type { Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Insets {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export interface PlaceholderKey {
    type: string;
    idx: string | null;
}
export interface ShapeInSlide {
    pkg: Package;
    slide: string;
    el: Element;
}
export declare function placeholderOf(el: Element): PlaceholderKey | null;
export declare function xfrmOf(el: Element): Element | null;
export declare function explicitBox(el: Element): Box | null;
export declare function box(shape: ShapeInSlide): Box | null;
export declare function insets(shape: ShapeInSlide): Insets;
export declare function fontSize(shape: ShapeInSlide, level: number): number;
