import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
export declare function createSyncApi(pool: MeshPool, log: LoggerInterface | null): Pick<CapabilityHandlers, 'syncStatusWatch'>;
