import type { QvacKnowledge } from '../../../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../../../mesh.ts';
import { type VectorHit } from 'rag-extract';
export declare function fullTextBudgetChars(ctxSize: number): number;
export interface IdentifiedHit {
    readonly id: string;
}
export declare function isFullTextHit(hit: IdentifiedHit): boolean;
export type FullTextCoverage = {
    readonly unit: 'pages';
    readonly included: number;
    readonly total: number;
} | {
    readonly unit: 'chars';
    readonly included: number;
    readonly total: number;
};
export declare function isTruncatedFullTextHit(hit: VectorHit): boolean;
export declare function formatFullDocumentContext(hits: ReadonlyArray<VectorHit>): string;
export interface FullTextOptions {
    readonly budgetChars: number;
    readonly head?: boolean;
}
export declare function fullTextHits(mesh: Mesh, rows: ReadonlyArray<QvacKnowledge>, { budgetChars, head }: FullTextOptions): Promise<VectorHit[] | null>;
