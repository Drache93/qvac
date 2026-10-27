import { CoreError } from '../../errors.js';
import { meshKind } from './mesh-kind.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
const ALL = ['account', 'public', 'workspace', 'project'];
const CONTENT = ['public', 'project'];
const PRIVATE = ['account', 'project'];
const AGENT = ['account', 'public', 'project'];
const SHARED_AGENT = ['account', 'public', 'workspace', 'project'];
const WORKSPACE = ['workspace'];
const PROJECT = ['project'];
const SHARED = ['workspace', 'project'];
export const ROUTE_ROLES = {
    '@qvac/append-chunk': CONTENT,
    '@qvac/update-chunk': CONTENT,
    '@qvac/resolve-approval': CONTENT,
    '@qvac/add-writer': ALL,
    '@qvac/remove-writer': ALL,
    '@qvac/join': PRIVATE,
    '@qvac/register-device': PRIVATE,
    '@qvac/update-device': ALL,
    '@qvac/put-agent': SHARED_AGENT,
    '@qvac/put-approval-rule': PRIVATE,
    '@qvac/seed-defaults': AGENT,
    '@qvac/add-knowledge': CONTENT,
    '@qvac/remove-knowledge': CONTENT,
    '@qvac/add-knowledge-artifact': CONTENT,
    '@qvac/report-device-capabilities': ALL,
    '@qvac/claim-indexing': CONTENT,
    '@qvac/resolve-indexing': CONTENT,
    '@qvac/put-chat': CONTENT,
    '@qvac/update-device-profile': ALL,
    '@qvac/report-device-version': ALL,
    '@qvac/put-tool-configs': PRIVATE,
    '@qvac/append-tool-activity': CONTENT,
    '@qvac/attest-device': ALL,
    '@qvac/mint-member': ALL,
    '@qvac/attest-member-device': ALL,
    '@qvac/update-member': ALL,
    '@qvac/migrate-agent-catalog': CONTENT,
    '@qvac/put-chat-group': CONTENT,
    '@qvac/join-member': ALL,
    '@qvac/put-joined-mesh': PRIVATE,
    '@qvac/remove-member': ALL,
    '@qvac/reindex-agents': ALL,
    '@qvac/put-mesh-invite-grant': PRIVATE,
    '@qvac/claim-invite': PRIVATE,
    '@qvac/mint-mesh-kind': ALL,
    '@qvac/vouched-join': PRIVATE,
    '@qvac/reindex-devices': ALL,
    '@qvac/recover-device': PRIVATE,
    '@qvac/purge-chat': CONTENT,
    '@qvac/name-mesh': ALL,
    '@qvac/open-join': ALL,
    '@qvac/put-mesh-seed': PRIVATE,
    '@qvac/raise-mesh-rules': ALL,
    '@qvac/put-public-mesh': ['account'],
    '@qvac/put-mesh-blind-peer': PRIVATE,
    '@qvac/put-workspace': WORKSPACE,
    '@qvac/set-member-role': WORKSPACE,
    '@qvac/put-public-seed': WORKSPACE,
    '@qvac/put-member-key': WORKSPACE,
    '@qvac/put-project': WORKSPACE,
    '@qvac/set-project-listing': WORKSPACE,
    '@qvac/put-project-key': WORKSPACE,
    '@qvac/put-project-host-key': WORKSPACE,
    '@qvac/put-project-device-key': WORKSPACE,
    '@qvac/put-project-member': PROJECT,
    '@qvac/put-project-order': ['account'],
    '@qvac/retry-indexing': PROJECT,
    '@qvac/progress-indexing': CONTENT,
    '@qvac/mark-chat-read': CONTENT,
    '@qvac/delete-project': WORKSPACE,
    '@qvac/set-knowledge-cap': PROJECT,
    '@qvac/upgrade-to-workspace': SHARED,
    '@qvac/take-model-request': CONTENT,
    '@qvac/settle-model-request': CONTENT,
    '@qvac/cancel-model-request': CONTENT,
    '@qvac/reopen-model-request': CONTENT,
    '@qvac/put-agent-user': WORKSPACE,
    '@qvac/agent-join': CONTENT,
    '@qvac/take-run-request': CONTENT,
    '@qvac/put-skill-secret': ['account']
};
export function inRole(role, route) {
    return ROUTE_ROLES[route]?.includes(role) ?? false;
}
export function publicRoute(name) {
    const route = `@qvac/${name}`;
    return inRole('public', route) && !inRole('account', route);
}
export function assertRoleRoute(role, name) {
    const route = `@qvac/${name}`;
    if (!inRole(role, route)) {
        throw new CoreError('ROUTE_NOT_IN_ROLE', [route, role]);
    }
}
function appliedRole(role, kind) {
    if (kind === 'workspace')
        return 'workspace';
    return kind === 'shared' || kind === 'project' ? 'project' : role;
}
function byKind(role) {
    return role === 'workspace' || role === 'project';
}
export function roleDrops(router, role) {
    return {
        add: (name, handler) => router.add(name, inRole(role, name) && !byKind(role)
            ? handler
            : async (op, context) => {
                if ((await rulesVersion(context.tx)) < WORKSPACES_RULES) {
                    return handler(op, context);
                }
                const applied = byKind(role) ? appliedRole(role, await meshKind(context.tx)) : role;
                if (inRole(applied, name)) {
                    return handler(op, context);
                }
                context.log?.warn('contract', `${name} dropped: not a route of a ${applied} mesh`);
            })
    };
}
