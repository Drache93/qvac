import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type LocalRunLogs } from '../core/local/run-logs.ts';
import { type MeshPool } from './current-mesh.ts';
export declare function createHostRunLogApi(pool: MeshPool, runLogs: LocalRunLogs, deviceId: Buffer | null): Pick<CapabilityHandlers, 'hostRunLogBegin' | 'hostRunLogAppend' | 'hostRunLogRelease'>;
