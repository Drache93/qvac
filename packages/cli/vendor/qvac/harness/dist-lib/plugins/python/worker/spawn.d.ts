import type { LogLevel } from '../../../lib/log.ts';
export interface WorkerLink {
    read(): Promise<unknown>;
    write(message: unknown): Promise<void>;
    kill(): void;
    reap(): void;
    ref(): void;
    unref(): void;
}
export interface WorkerData {
    readonly sab: SharedArrayBuffer;
    readonly log: LogLevel;
}
export declare function spawnPythonWorker(entry: string, data: WorkerData): WorkerLink;
export declare function preloadWorker(entry: string): Promise<void>;
