import type { Document, Element } from '../xml.ts';
import type { Deck } from './slides.ts';
export declare function notesBody(doc: Document, id: number): Element;
export declare function writeNotes(deck: Deck, slidePart: string, value: unknown): void;
export declare function notesText(deck: Deck, slidePart: string): string | null;
