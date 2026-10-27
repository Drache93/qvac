import type { Document, Element } from '../xml.ts';
export declare const CONTENT_TYPES_NAME = "/[Content_Types].xml";
export declare class ContentTypes {
    doc: Document;
    dirty: boolean;
    private original;
    constructor(bytes: Uint8Array | null);
    get root(): Element;
    get(partName: string): string | null;
    hasDefault(ext: string): boolean;
    addDefault(ext: string, contentType: string): void;
    setOverride(partName: string, contentType: string): void;
    removeOverride(partName: string): void;
    serialize(): Uint8Array;
    private defaults;
    private override;
}
