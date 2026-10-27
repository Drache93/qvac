export interface ModelProgressFrame {
    type: string;
    [key: string]: unknown;
}
export interface ProgressBytes {
    downloaded: number;
    total: number;
    aggregate: boolean;
}
export interface TransferProgress extends ProgressBytes {
    percentage: number;
}
export declare function transferProgress(event: Record<string, unknown>): TransferProgress | null;
export declare function progressBytes(event: ModelProgressFrame): ProgressBytes;
export declare class DownloadSpeedSampler {
    private _downloaded;
    private _at;
    private _bytesPerSecond;
    private _downloadKey;
    sample(bytes: ProgressBytes, at: number, downloadKey: unknown): number;
    private _reset;
}
