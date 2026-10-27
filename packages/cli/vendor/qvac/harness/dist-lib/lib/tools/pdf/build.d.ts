import type { PdfRequest } from './request.ts';
export type Pdfium = typeof import('bare-pdfium');
export type Doc = ReturnType<Pdfium['open']>;
type Field = ReturnType<Doc['fields']>[number];
export interface Source {
    readonly attachmentId: string;
    readonly fileName: string;
    readonly bytes: Uint8Array;
}
export interface Opened {
    readonly source: Source;
    readonly doc: Doc;
}
export interface Built {
    readonly bytes: Uint8Array;
    readonly pageCount: number;
}
export interface ReadField {
    readonly name: string;
    readonly type: string;
    readonly value: Field['value'];
    readonly options: readonly string[] | undefined;
    readonly readOnly: true | undefined;
}
export interface ReadDocument {
    readonly attachmentId: string;
    readonly fileName: string;
    readonly pageCount: number;
    readonly pages: readonly {
        page: number;
        text: string;
    }[];
    readonly fields: readonly ReadField[];
    readonly note: string | undefined;
    readonly truncated: true | undefined;
}
export interface ReadDocuments {
    readonly documents: readonly ReadDocument[];
}
export declare function pagesLabel(count: number): string;
export type ShownPage = (fileName: string, page: number) => boolean;
export declare function textless({ doc }: Opened): boolean;
export declare function everyPageShown({ source, doc }: Opened, isShown: ShownPage): boolean;
export declare function shownNote({ source, doc }: Opened): string;
export declare function readDocs(opened: readonly Opened[], isShown: ShownPage): ReadDocument | ReadDocuments;
export declare function build(pdfium: Pdfium, request: PdfRequest, opened: readonly Opened[]): Built | string;
export {};
