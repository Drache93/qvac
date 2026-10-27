import type { Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
import type { AddSlideOptions } from './types.ts';
export interface Deck {
    pkg: Package;
    main: string;
}
export interface SlideEntry {
    el: Element;
    id: string;
    rId: string;
    part: string;
}
interface LayoutEntry {
    master: string;
    part: string;
}
export declare const PRESENTATION_ORDER: string[];
export declare function slideIdList(deck: Deck): Element | null;
export declare function ensureSlideIdList(deck: Deck): Element;
export declare function entries(deck: Deck): SlideEntry[];
export declare function slideAt(deck: Deck, index: unknown): SlideEntry;
export declare function layoutOf(pkg: Package, slidePart: string): string | null;
export declare function allLayouts(deck: Deck): LayoutEntry[];
export declare function pickLayout(deck: Deck, opts: AddSlideOptions): string;
export declare function placeInSection(deck: Deck, id: string): void;
export {};
