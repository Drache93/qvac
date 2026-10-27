import type { Harness } from './assistant.ts';
import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from './core/local/index.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export type ModelIdleTarget = Pick<Harness, 'setModelIdleTimeout'>;
export type ModelIdleSource = Pick<LocalStore, 'get' | 'watch' | 'unwatch'>;
export declare function startModelIdlePusher(harness: ModelIdleTarget, state: ModelIdleSource, logger?: LoggerInterface | null): () => Promise<void>;
export {};
