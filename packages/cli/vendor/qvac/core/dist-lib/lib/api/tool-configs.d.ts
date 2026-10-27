import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { getToolConfigs } from '../core/tool-configs.ts';
import { type MeshPool } from './current-mesh.ts';
type ToolConfigsCapabilities = Pick<CapabilityHandlers, 'setToolConfigs' | 'deleteToolConfigs' | 'listToolConfigs' | 'toolConfigsWatch'>;
export declare function createToolConfigsApi(pool: MeshPool, log: LoggerInterface | null): ToolConfigsCapabilities;
export { getToolConfigs };
