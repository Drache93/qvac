import type { Harness } from './assistant.ts';
import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from './core/local/index.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export type ModelMemoryTarget = Pick<Harness, 'setModelMemoryCap' | 'capability' | 'memoryUsage'>;
export type ModelMemorySource = Pick<LocalStore, 'get' | 'watch' | 'unwatch'>;
export interface ModelMemorySummary {
    readonly usableBytes: number;
    readonly capPercent: number;
    readonly capBytes: number;
}
export interface ModelMemoryUse extends ModelMemorySummary {
    readonly usedBytes: number;
    readonly overCap: boolean;
}
export interface ModelMemoryCap {
    summary(): Promise<ModelMemoryUse | null>;
    stop(): Promise<void>;
}
export interface ModelMemoryCapOptions {
    logger?: LoggerInterface | null;
    onPushed?: () => void;
}
export declare function startModelMemoryCap(harness: ModelMemoryTarget, state: ModelMemorySource, { logger, onPushed }?: ModelMemoryCapOptions): ModelMemoryCap;
export declare function withUsage(cap: ModelMemorySummary, usedBytes: number): ModelMemoryUse;
export declare function memoryCapPercent(value: unknown): number;
export {};
