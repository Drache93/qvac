import type { HarnessPreviewModelSourceResponse } from '../../spec/hyperschema/types.d.ts';
import type { FitAssessment, FitQuery, ModelFitVerdict } from '../models/model-fit.ts';
export type ModelSourceRefusal = 'invalid-source' | 'not-found' | 'private' | 'gated' | 'web-page' | 'unreachable' | 'not-gguf' | 'not-a-model' | 'no-model-files' | 'invalid-projection';
export interface ModelSourceFile {
    src: string;
    label: string;
    sizeBytes: number;
}
export interface ModelSourcePreview {
    ok: boolean;
    refusal?: ModelSourceRefusal;
    reason?: string;
    src?: string;
    files?: ModelSourceFile[];
    sizeBytes?: number;
    contextLength?: number;
    architecture?: string;
    sizeLabel?: string;
    taskType?: string;
    license?: string;
    fit?: ModelFitVerdict;
    fitReasons?: string[];
    mmprojSrc?: string;
}
export interface PreviewModelSourceContext {
    src: string;
    mmprojSrc?: string;
}
export interface PreviewResponse {
    ok: boolean;
    status: number;
    headers: {
        get(name: string): string | null;
    };
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
}
export type PreviewFetch = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    redirect?: 'follow';
}) => Promise<PreviewResponse>;
export interface PreviewDeps {
    fetch?: PreviewFetch;
    stat?(path: string): Promise<FileStat | null>;
    assessFit?(query: FitQuery): Promise<FitAssessment>;
    contextSize?: number | undefined;
    recentFits?: Map<string, RecentFit> | undefined;
}
export interface RecentFit {
    readonly fit: Promise<PreviewFit>;
    readonly at: number;
}
export interface FileStat {
    size: number;
}
type PreviewFit = Required<Pick<ModelSourcePreview, 'fit' | 'fitReasons'>>;
interface HuggingFaceRef {
    repo: string;
    revision: string;
    file?: string;
}
export declare function previewModelSource(context: PreviewModelSourceContext, deps?: PreviewDeps): Promise<ModelSourcePreview>;
export declare function readModelSourcePreview(response: HarnessPreviewModelSourceResponse): ModelSourcePreview;
export declare function parseHuggingFaceRef(src: string): HuggingFaceRef | null;
export {};
