import type { LoggerInterface } from '@qvac/logging';
import type { AssistantAppConfig } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export declare function writeAutoDownloadModels(state: LocalStore, enabled: boolean): Promise<AssistantAppConfig>;
export declare function createAppConfigApi(state: LocalStore, log: LoggerInterface | null): Pick<CapabilityHandlers, 'getConfig' | 'setConfig' | 'setModelPaused' | 'setModelReleased' | 'setAutoDownloadModels' | 'configWatchTyped'>;
export {};
