import { registerAgentJoinRoutes } from './agent-join.js';
import { registerAgentRoutes } from './agents.js';
import { registerApprovalRuleRoutes } from './approval-rules.js';
import { registerAttestationRoutes } from './attestations.js';
import { registerChatRoutes } from './chat.js';
import { registerChatGroupRoutes } from './chat-group.js';
import { registerChunkRoutes } from './chunks.js';
import { registerDeviceRoutes } from './devices.js';
import { registerIndexingRoutes } from './indexing.js';
import { registerInviteRoutes } from './invites.js';
import { registerKnowledgeRoutes } from './knowledge.js';
import { registerJoinedMeshRoutes } from './joined-meshes.js';
import { registerMemberRoutes } from './members.js';
import { modelOutputOnly, registerModelRequestRoutes } from './model-requests.js';
import { registerMeshKindRoutes } from './mesh-kind.js';
import { registerMeshNameRoutes } from './mesh-name.js';
import { registerMeshRulesRoutes } from './mesh-rules.js';
import { registerMeshSeedRoutes } from './mesh-seeds.js';
import { registerOpenJoinRoutes } from './open-join.js';
import { registerProjectOrderRoutes } from './project-order.js';
import { registerProjectRoutes } from './projects.js';
import { registerPublicMeshRoutes } from './public-mesh.js';
import { registerRunRequestRoutes } from './run-requests.js';
import { roleDrops } from './roles.js';
import { registerMeshBlindPeerRoutes, registerSeedDefaultsRoutes } from './seed-defaults.js';
import { registerSkillSecretRoutes } from './skill-secrets.js';
import { registerToolActivityRoutes } from './tool-activity.js';
import { registerToolConfigsRoutes } from './tool-configs.js';
import { registerWorkspaceRoutes } from './workspace.js';
import { registerWriterRoutes } from './writers.js';
const OPTIMISTIC_ROUTES = new Set([
    '@qvac/join',
    '@qvac/claim-invite',
    '@qvac/recover-device',
    '@qvac/attest-device',
    '@qvac/join-member',
    '@qvac/open-join',
    '@qvac/agent-join'
]);
function writersOnly(router) {
    return {
        add: (name, handler) => router.add(name, OPTIMISTIC_ROUTES.has(name)
            ? handler
            : async (op, context) => {
                if (!context.node.optimistic) {
                    return handler(op, context);
                }
                context.log?.warn('contract', `${name} dropped: its author is not a writer here`);
            })
    };
}
export function registerRoutes(target, { role = 'account' } = {}) {
    const router = modelOutputOnly(writersOnly(roleDrops(target, role)));
    registerWriterRoutes(router);
    registerChunkRoutes(router);
    registerModelRequestRoutes(router);
    registerRunRequestRoutes(router);
    registerAgentRoutes(router);
    registerAgentJoinRoutes(router);
    registerChatRoutes(router);
    registerChatGroupRoutes(router);
    registerApprovalRuleRoutes(router);
    registerDeviceRoutes(router);
    registerKnowledgeRoutes(router);
    registerIndexingRoutes(router);
    registerSeedDefaultsRoutes(router, { role });
    registerMeshBlindPeerRoutes(router);
    registerToolConfigsRoutes(router);
    registerToolActivityRoutes(router);
    registerAttestationRoutes(router);
    registerJoinedMeshRoutes(router);
    registerMemberRoutes(router);
    registerInviteRoutes(router);
    registerMeshKindRoutes(router);
    registerMeshNameRoutes(router);
    registerOpenJoinRoutes(router);
    registerMeshSeedRoutes(router);
    registerMeshRulesRoutes(router);
    registerPublicMeshRoutes(router);
    registerWorkspaceRoutes(router);
    registerProjectRoutes(router);
    registerProjectOrderRoutes(router);
    registerSkillSecretRoutes(router);
}
