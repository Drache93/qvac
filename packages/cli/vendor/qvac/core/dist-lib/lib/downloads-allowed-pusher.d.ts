import type { Harness } from './assistant.ts';
import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from './core/local/index.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export type DownloadsAllowedTarget = Pick<Harness, 'setDownloadsAllowed'>;
export type DownloadsAllowedSource = Pick<LocalStore, 'getAppConfigRow' | 'watch' | 'unwatch'>;
export declare function startDownloadsAllowedPusher(harness: DownloadsAllowedTarget, state: DownloadsAllowedSource, logger?: LoggerInterface | null): () => Promise<void>;
export {};
