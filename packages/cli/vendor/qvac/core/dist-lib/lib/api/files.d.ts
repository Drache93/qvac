import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
export declare function createFilesApi(pool: MeshPool): Pick<CapabilityHandlers, 'fileRead' | 'filePreview' | 'fileRetry'>;
