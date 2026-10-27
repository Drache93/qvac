import type { openLocalStore } from '../core/local/index.ts';
import type { Harness } from './harness.ts';
import type { LoggerInterface } from '@qvac/logging';
export declare const MAX_QUACKS = 500;
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export type FakeModelsSource = Pick<LocalStore, 'get' | 'watch' | 'unwatch'>;
export interface FakeModelsOptions {
    enabled?: () => boolean;
    paceMs?: number;
}
export declare function quackCount(prompt: string): number;
export declare function readFakeModels(state: Pick<FakeModelsSource, 'get'>): Promise<boolean>;
export interface FakeModelsWatchOptions {
    initial: boolean;
    onChange: (enabled: boolean) => void;
    logger?: LoggerInterface | null;
}
export declare function watchFakeModels(state: FakeModelsSource, opts: FakeModelsWatchOptions): () => Promise<void>;
export declare function withFakeModels(harness: Harness, opts?: FakeModelsOptions): Harness;
export {};
