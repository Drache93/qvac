import type { Document, Element } from '../xml.ts';
export interface Relationship {
    id: string;
    type: string;
    target: string;
    external: boolean;
    part: string | null;
}
export declare class Relationships {
    source: string;
    name: string;
    doc: Document;
    dirty: boolean;
    constructor(source: string, bytes: Uint8Array | null);
    get root(): Element;
    all(): Relationship[];
    get(id: string | null): Relationship | null;
    byType(type: string): Relationship[];
    targeting(partName: string): Relationship[];
    add(type: string, partName: string): string;
    remove(id: string): boolean;
    serialize(): Uint8Array;
}
