import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
type ToolActivityCapabilities = Pick<CapabilityHandlers, 'listToolActivity' | 'toolActivityWatch' | 'recordToolActivity'>;
export declare function createToolActivityApi(pool: MeshPool, deviceId: Buffer | null, log: LoggerInterface | null): ToolActivityCapabilities;
export {};
