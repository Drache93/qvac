import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from '../core/local/index.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export declare function createConfigApi(state: LocalStore, log: LoggerInterface | null, onset?: ((key: string) => void) | null): Pick<CapabilityHandlers, 'configGet' | 'configSet' | 'configWatch'>;
export {};
