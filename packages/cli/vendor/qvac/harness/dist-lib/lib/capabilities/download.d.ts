import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ModelProgressUpdate } from '@qvac/inference';
import { Readable } from 'streamx';
import { type ModelAddon, type ModelRegistrySdk } from '../models/model-source.ts';
export type DownloadProgress = Omit<ModelProgressUpdate, 'type'>;
export type DownloadProgressEvent = {
    type: 'progress';
    transferred?: boolean;
} & DownloadProgress;
export type DownloadCompleteEvent = {
    type: 'complete';
    assetId: string;
    downloaded?: boolean;
};
export type DownloadErrorEvent = {
    type: 'error';
    message: string;
};
export type DownloadAbortedEvent = {
    type: 'aborted';
};
export type DownloadEvent = DownloadProgressEvent | DownloadCompleteEvent | DownloadErrorEvent | DownloadAbortedEvent;
export interface DownloadSdk extends ModelRegistrySdk {
    downloadAsset(options: {
        assetSrc: string;
        seed?: boolean;
        onProgress?: (progress: DownloadProgress) => void;
    }): Promise<string> & {
        requestId?: string;
    };
    cancel?(params: {
        requestId: string;
    }): Promise<void>;
}
export interface DownloadArgs {
    model: string;
    addon?: ModelAddon;
    seed?: boolean;
    signal?: BareAbortSignal;
    projection?: string;
    companions?: ReadonlyArray<string>;
    assetSizes?: Readonly<Record<string, number>>;
}
export type SdkOrLoader = DownloadSdk | (() => Promise<DownloadSdk>);
export interface DownloadEventStream extends Readable {
    [Symbol.asyncIterator](): AsyncIterableIterator<DownloadEvent>;
}
type TerminalEvent = Exclude<DownloadEvent, DownloadProgressEvent>;
export declare function download(sdkOrLoader: SdkOrLoader, args: DownloadArgs, onSettled?: (event: TerminalEvent) => void, onDrained?: () => void): DownloadEventStream;
export {};
