import type { QvacIndexingStatus } from '../../../../spec/mesh/hyperschema/types.d.ts';
import { INDEXING_FAILURES } from '../../../../schema/engine.ts';
export type IndexingFailureReason = (typeof INDEXING_FAILURES)[number];
export interface ContentCheck {
    readonly supported: boolean;
}
export interface ParsedFailure {
    readonly reason: IndexingFailureReason;
    readonly detail: string | null;
}
export declare class IndexingFailure extends Error {
    readonly reason: IndexingFailureReason;
    constructor(reason: IndexingFailureReason, message: string);
}
export declare function contentFailure(fileName: string, bytes: Uint8Array, { supported }: ContentCheck): IndexingFailure | null;
export declare function failureReason(err: unknown): IndexingFailureReason;
export declare function failureDetail(err: unknown): string;
export declare function failureError(err: unknown): string;
export declare function parseFailure(error: string | null | undefined): ParsedFailure;
export declare function isContentFailure(row: QvacIndexingStatus): boolean;
