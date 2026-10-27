import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from '../core/local/index.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export declare function createModelDownloadApi(state: LocalStore, log: LoggerInterface | null): Pick<CapabilityHandlers, 'modelDownloadsWatch' | 'setModelDownloadStatus' | 'clearModelDownload' | 'beginModelTransfer' | 'completeModelTransfer'>;
export {};
