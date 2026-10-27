import { createAgent, deleteAgent, getAgent, getDefaultAgent, isOrphaned, listAgents, liveProviderIds, mustGetActiveAgent, mustGetAgent, updateAgent } from '../core/agent.js';
import { runDefinition, shareAgent, unshareAgent, workspaceAgents } from '../core/shared-agents.js';
import { softDeleteToolConfigsForAgent } from '../core/tool-configs.js';
import { CoreError } from '../errors.js';
import { requireMesh } from './current-mesh.js';
import { requireOurMember, requireWorkspace } from './members.js';
import { watchable } from './watchable.js';
import b4a from 'b4a';
const WORKSPACE_ROWS = { route: 'put-project' };
const CHAT_ROWS = { route: 'put-chat' };
async function notPicked(mesh, agentId) {
    if ((await getAgent(mesh, agentId))?.sharedIn) {
        throw new CoreError('AGENT_NOT_OURS');
    }
}
async function definitions(mesh, rows) {
    const resolved = await Promise.all(rows.map((row) => runDefinition(mesh, row)));
    return resolved.filter((row) => row !== null);
}
export function createAgentsApi(pool, { deviceId, changed = null, keepCopies = null, peers = null, accountChanges = null, folders, log }) {
    const reachable = () => new Set([
        ...(peers?.snapshot().peerDeviceIds ?? []),
        ...(deviceId ? [b4a.toHex(deviceId)] : [])
    ]);
    const withDerived = async (mesh, agent) => ({
        ...agent,
        lenderDeviceId: undefined,
        orphaned: await isOrphaned(mesh, agent),
        hostReachable: reachable().has(b4a.toHex(agent.providerDeviceId))
    });
    const list = async ({ meshId, providerDeviceId }) => {
        const mesh = await requireMesh(pool, meshId);
        const scope = await requireMesh(pool, meshId, WORKSPACE_ROWS);
        const listed = scope.role === 'workspace' && scope !== mesh
            ? await workspaceAgents(scope, await listAgents(mesh))
            : await definitions(mesh, await listAgents(mesh));
        const agents = listed.filter((agent) => !providerDeviceId || b4a.equals(agent.providerDeviceId, providerDeviceId));
        const picked = await mesh.pickedFrom?.();
        const live = new Set([
            ...(await liveProviderIds(mesh)),
            ...(scope === mesh ? [] : await liveProviderIds(scope)),
            ...(picked ? await liveProviderIds(picked) : [])
        ]);
        const hosts = reachable();
        return {
            agents: agents.map((agent) => {
                const host = b4a.toHex(agent.providerDeviceId);
                return {
                    ...agent,
                    lenderDeviceId: undefined,
                    orphaned: !live.has(host),
                    hostReachable: hosts.has(host)
                };
            })
        };
    };
    const sharing = async (meshId) => {
        const workspace = await requireMesh(pool, meshId, WORKSPACE_ROWS);
        requireWorkspace(workspace, meshId);
        await requireOurMember(workspace);
        const account = await requireMesh(pool, meshId);
        if (account.role !== 'account') {
            throw new CoreError('MESH_NOT_FOUND', [meshId]);
        }
        return { account, workspace };
    };
    const agentHolder = async (meshId, agentId) => {
        const mesh = await requireMesh(pool, meshId);
        const chats = await requireMesh(pool, meshId, CHAT_ROWS);
        return chats !== mesh && !(await getAgent(mesh, agentId)) ? chats : mesh;
    };
    return {
        createAgent: async ({ meshId, config }) => {
            const mesh = await requireMesh(pool, meshId);
            return withDerived(mesh, await createAgent(mesh, config));
        },
        listAgents: list,
        getAgent: async ({ agentId, meshId }) => {
            const mesh = await agentHolder(meshId, agentId);
            const row = await mustGetAgent(mesh, agentId);
            if (!row.sharedIn) {
                await mustGetActiveAgent(mesh, agentId);
            }
            const agent = await runDefinition(mesh, row);
            if (!agent) {
                throw new CoreError('CHAT_AGENT_UNAVAILABLE');
            }
            return withDerived((await mesh.pickedFrom?.()) ?? mesh, agent);
        },
        getDefaultAgent: async ({ meshId, providerDeviceId }) => {
            const mesh = await requireMesh(pool, meshId);
            const agent = await getDefaultAgent(mesh, providerDeviceId ?? undefined);
            if (!agent || (await runDefinition(mesh, agent)) !== agent) {
                return {};
            }
            return { agent: await withDerived(mesh, agent) };
        },
        updateAgent: async ({ agentId, meshId, config }) => {
            const mesh = await requireMesh(pool, meshId);
            await notPicked(mesh, agentId);
            const updated = await updateAgent(mesh, agentId, config);
            await changed?.(agentId);
            return withDerived(mesh, updated);
        },
        deleteAgent: async ({ agentId, meshId, keepChats }) => {
            const mesh = await requireMesh(pool, meshId);
            await notPicked(mesh, agentId);
            const deleted = await deleteAgent(mesh, deviceId, { id: agentId, keepChats, keepCopies });
            await changed?.(agentId);
            await folders?.forget(agentId);
            const configs = await requireMesh(pool, meshId, { route: 'put-tool-configs' });
            if (configs !== mesh) {
                await softDeleteToolConfigsForAgent(configs, agentId);
            }
            return withDerived(mesh, deleted);
        },
        agentsWatch: watchable((request) => requireMesh(pool, request.meshId, { ...WORKSPACE_ROWS, follow: true }), (request) => list(request), {
            name: 'agentsWatch',
            log,
            changes: {
                watch: (listener) => {
                    peers?.watch(listener);
                    accountChanges?.watch(listener);
                },
                unwatch: (listener) => {
                    peers?.unwatch(listener);
                    accountChanges?.unwatch(listener);
                }
            }
        }),
        shareAgent: async ({ agentId, meshId }) => {
            const { account, workspace } = await sharing(meshId);
            const shared = await shareAgent(account, workspace, agentId);
            return {
                ...shared,
                orphaned: false,
                hostReachable: reachable().has(b4a.toHex(shared.providerDeviceId)),
                ownerMemberId: workspace.ourMemberId,
                shared: true
            };
        },
        unshareAgent: async ({ agentId, meshId }) => {
            await unshareAgent((await sharing(meshId)).workspace, agentId);
            return { ok: true };
        }
    };
}
