import type { AbortSignal } from 'bare-abort-controller';
import type { QvacKnowledgeArtifact } from '../../../../spec/mesh/hyperschema/types.d.ts';
import type { FileDocument, FileProcessor, ProcessorHost } from '../processing/index.ts';
import { type FileRecord } from '../records/index.ts';
import { type PreviewEncoder } from './image.ts';
export { previewEncoder } from './image.ts';
export type { PreviewEncoder } from './image.ts';
export declare const PREVIEW_VERSION = "processor:preview:1";
export interface PreviewProcessorOptions {
    readonly deviceId: Buffer | null;
    readonly retryMs?: number;
    readonly encoder?: () => Promise<PreviewEncoder | null>;
}
export declare class PreviewProcessor implements FileProcessor {
    readonly id = "preview";
    readonly version = "processor:preview:1";
    readonly input = "attachment";
    readonly output = "inline";
    readonly mediaKind = "image";
    private readonly _deviceId;
    private readonly _retryMs;
    private readonly _encoder;
    constructor(options: PreviewProcessorOptions);
    applies(file: FileRecord): boolean;
    canProduce(file: FileRecord, host: ProcessorHost): Promise<boolean>;
    accepts(output: QvacKnowledgeArtifact, file: FileRecord): boolean;
    produce(document: FileDocument, signal: AbortSignal): Promise<void>;
    close(): Promise<boolean>;
}
export declare function previewId(file: Pick<FileRecord, 'id' | 'blobId'>): string;
