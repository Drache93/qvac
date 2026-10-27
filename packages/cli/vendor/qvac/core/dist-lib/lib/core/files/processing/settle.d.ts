import type { AbortSignal } from 'bare-abort-controller';
import type { Files } from '../index.ts';
import type { FileProcessing } from './index.ts';
export interface SettleOptions {
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
}
export interface SettleFilesOptions extends SettleOptions {
    readonly ids: string[];
    readonly processing: FileProcessing;
    readonly chatIds: () => Promise<string[]>;
}
export declare function settleFiles(files: Files, options: SettleFilesOptions): Promise<void>;
