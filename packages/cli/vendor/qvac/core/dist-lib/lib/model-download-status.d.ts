import type { LoggerInterface } from '@qvac/logging';
export type ModelDownloadPhase = 'queued' | 'downloading' | 'paused' | 'error' | 'held';
export interface StatusRow {
    phase: ModelDownloadPhase;
    percentage: number;
    error: string | null;
    downloaded: number;
    total: number;
    bytesPerSecond: number;
}
type StatusPatch = Partial<Pick<StatusRow, 'percentage' | 'error' | 'downloaded' | 'total' | 'bytesPerSecond'>>;
interface StatusEngine {
    setModelDownloadStatus(request: StatusRow & {
        name: string;
    }): Promise<unknown>;
    clearModelDownload(request: {
        name: string;
    }): Promise<unknown>;
}
export declare class ModelDownloadStatus {
    private readonly _rows;
    private readonly _engine;
    private readonly _log;
    constructor(engine: StatusEngine, logger?: LoggerInterface | null);
    write(name: string, phase: ModelDownloadPhase, patch?: StatusPatch): Promise<boolean>;
    clear(name: string): Promise<void>;
    clearUnwanted(wanted: ReadonlySet<string>): Promise<void>;
}
export {};
