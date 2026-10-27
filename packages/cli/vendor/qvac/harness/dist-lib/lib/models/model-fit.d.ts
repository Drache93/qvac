import type { AssessModelFitInput, AssessModelFitResult } from '@qvac/inference';
export type ModelFitVerdict = AssessModelFitResult['verdict'];
export type ModelFitBasis = AssessModelFitResult['basis'];
export type ModelFitEvidence = NonNullable<AssessModelFitResult['evidence']>;
export type FitModelType = 'llm' | 'embeddings';
export interface FitQuery {
    src: string;
    sha256Checksum?: string;
    name: string;
    registryPath?: string;
    registrySource?: string;
    modelType?: FitModelType;
    contextTokens: number;
}
export interface FitAssessment {
    verdict: ModelFitVerdict;
    basis: ModelFitBasis;
    evidence?: ModelFitEvidence | undefined;
    reasons: string[];
}
export interface FitAsset {
    readonly src: string;
    readonly sha256Checksum: string;
    readonly name: string;
    readonly registryPath: string;
    readonly registrySource: string;
}
export interface ContextChoice {
    ctxSize: number;
    slots: number;
    fits: boolean;
}
export interface FitQueryOptions {
    readonly native?: boolean;
    readonly modelType?: FitModelType;
}
export type AssessModelFit = (input: AssessModelFitInput) => Promise<AssessModelFitResult>;
export declare class ModelFit {
    private readonly _assess;
    private readonly _chosen;
    private _rows;
    constructor(assess: AssessModelFit);
    static query(asset: FitAsset, contextTokens: number, { native, modelType }?: FitQueryOptions): FitQuery;
    static confirms(assessed: FitAssessment | null): boolean;
    assess(query: FitQuery): Promise<FitAssessment>;
    rows(queries: () => ReadonlyMap<string, FitQuery>): Promise<ReadonlyMap<string, FitAssessment>>;
    clearRows(): void;
    chosen(key: string): number | undefined;
    chosenSlots(key: string): number | undefined;
    keep(key: string, { ctxSize, slots }: ContextChoice): void;
    ladder(asset: FitAsset, tier: number, slots?: number): Promise<ContextChoice>;
    private _steps;
    private _ask;
    settle(query: FitQuery): Promise<FitAssessment | null>;
}
