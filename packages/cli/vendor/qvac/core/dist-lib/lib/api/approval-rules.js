import { listApprovalRules } from '../core/approval-rules.js';
import { requireMesh } from './current-mesh.js';
export function createApprovalRulesApi(pool) {
    return {
        listApprovalRules: async (request) => {
            const mesh = await requireMesh(pool, request.meshId);
            return {
                rules: await listApprovalRules(mesh),
                ourMemberId: mesh.ourMemberId ?? undefined
            };
        }
    };
}
