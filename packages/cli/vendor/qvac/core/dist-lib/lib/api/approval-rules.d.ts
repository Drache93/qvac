import { type MeshPool } from './current-mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export declare function createApprovalRulesApi(pool: MeshPool): Pick<CapabilityHandlers, 'listApprovalRules'>;
