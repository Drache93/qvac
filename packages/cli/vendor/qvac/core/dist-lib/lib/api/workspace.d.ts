import type { LoggerInterface } from '@qvac/logging';
import { type MeshPool } from './current-mesh.ts';
import type { MeshStatusSource } from './mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export declare function createWorkspaceApi(pool: MeshPool, status: Pick<MeshStatusSource, 'createWorkspace' | 'name' | 'leaveWorkspace'>, log: LoggerInterface | null): Pick<CapabilityHandlers, 'createWorkspace' | 'getWorkspace' | 'workspaceWatch' | 'updateWorkspace' | 'leaveWorkspace'>;
