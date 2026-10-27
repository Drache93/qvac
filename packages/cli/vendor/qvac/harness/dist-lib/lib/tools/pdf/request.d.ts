export declare const PDF_ACTIONS: readonly ['create', 'merge', 'split', 'rotate', 'watermark', 'fill', 'encrypt', 'decrypt', 'text'];
export declare const PAGE_SIZES: readonly ['A4', 'A5', 'Letter', 'Legal'];
export declare const DEGREES: readonly [90, 180, 270];
export declare const WHERE_IDS_ARE = "copy the id from the [Attached file \"\u2026\" \u2014 attachmentId: \u2026] line or an earlier tool result";
export type Action = (typeof PDF_ACTIONS)[number];
export type PageSize = (typeof PAGE_SIZES)[number];
export type FieldValue = string | number | boolean | string[];
export interface Permissions {
    print?: boolean;
    modify?: boolean;
    copy?: boolean;
    annotate?: boolean;
    fillForms?: boolean;
    extract?: boolean;
    assemble?: boolean;
    printHighQuality?: boolean;
}
interface Common {
    readonly ids: readonly string[];
    readonly password: string | undefined;
    readonly output: string | undefined;
}
export type PdfRequest = (Common & {
    readonly action: 'read';
}) | (Common & {
    readonly action: 'create';
    readonly markdown: string;
    readonly pageSize: PageSize | undefined;
    readonly landscape: boolean;
    readonly pageNumbers: boolean;
}) | (Common & {
    readonly action: 'merge' | 'decrypt' | 'text';
}) | (Common & {
    readonly action: 'split';
    readonly pages: readonly number[];
}) | (Common & {
    readonly action: 'rotate';
    readonly degrees: number;
    readonly pages: readonly number[] | undefined;
}) | (Common & {
    readonly action: 'watermark';
    readonly text: string;
    readonly opacity: number | undefined;
    readonly position: 'over' | 'under' | undefined;
    readonly pages: readonly number[] | undefined;
}) | (Common & {
    readonly action: 'fill';
    readonly values: Record<string, FieldValue>;
}) | (Common & {
    readonly action: 'encrypt';
    readonly ownerPassword: string | undefined;
    readonly permissions: Permissions | undefined;
});
export type CreateRequest = Extract<PdfRequest, {
    action: 'create';
}>;
export declare function parsePages(value: unknown): number[] | string;
type Args = Record<string, unknown>;
export declare function impliedAction(args: Args): Action | 'read';
export declare function pageSizeOf(value: unknown): PageSize | undefined;
export declare function quarterTurn(value: unknown): number | undefined;
export declare function parseRequest(args: Record<string, unknown>): PdfRequest | string;
export {};
