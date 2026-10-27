import b4a from 'b4a';
import { encode } from '../../spec/mesh/hyperschema/index.js';
import { CoreError } from '../errors.js';
import { mustGetActiveAgent } from './agent.js';
import { copyAgent } from './agent-copies.js';
import { stripped } from './chat-copy.js';
import { listsMember, readProject } from './contract/projects.js';
import { ACTIVE_CHATS_BY_AGENT, AGENT_USERS, AGENTS, DEVICES } from './collections.js';
export async function ownerOf(workspace, agent) {
    const device = await workspace.view.get(DEVICES, { id: agent.providerDeviceId });
    return device?.memberId ?? null;
}
async function ours(workspace, agent) {
    const owner = await ownerOf(workspace, agent);
    return !!owner && !!workspace.ourMemberId && b4a.equals(owner, workspace.ourMemberId);
}
async function theirs(workspace, agent) {
    const owner = await ownerOf(workspace, agent);
    return !!owner && !!workspace.ourMemberId && !b4a.equals(owner, workspace.ourMemberId);
}
export async function liveSharedAgent(workspace, agentId) {
    const agent = await workspace.view.get(AGENTS, { id: agentId });
    return agent && !agent.deletedAt ? agent : null;
}
function sharedRow(agent, updatedAt) {
    return { ...stripped(agent), isDefault: false, updatedAt };
}
export async function shareAgent(account, workspace, agentId) {
    const agent = await mustGetActiveAgent(account, agentId);
    if (!(await ours(workspace, agent))) {
        throw new CoreError('AGENT_HOST_NOT_IN_WORKSPACE');
    }
    const held = await workspace.view.get(AGENTS, { id: agentId });
    if (held && !held.deletedAt && !(await ours(workspace, held))) {
        throw new CoreError('AGENT_NOT_OURS');
    }
    if (held && !held.deletedAt && held.updatedAt >= agent.updatedAt) {
        return held;
    }
    const row = sharedRow(agent, Math.max(agent.updatedAt, (held?.updatedAt ?? 0) + 1));
    await workspace.dispatch('put-agent', { agent: row });
    return row;
}
export async function unshareAgent(workspace, agentId) {
    const shared = await liveSharedAgent(workspace, agentId);
    if (!shared) {
        throw new CoreError('AGENT_NOT_SHARED', [agentId]);
    }
    if (!(await ours(workspace, shared))) {
        throw new CoreError('AGENT_NOT_OURS');
    }
    const at = Math.max(Date.now(), shared.updatedAt + 1);
    await workspace.dispatch('put-agent', { agent: { ...shared, deletedAt: at, updatedAt: at } });
}
export async function followSharedAgents(account, workspace) {
    for (const copy of await workspace.view.find(AGENTS).toArray()) {
        if (workspace.closing || account.closing)
            return;
        if (copy.deletedAt || !(await ours(workspace, copy)))
            continue;
        const agent = await account.view.get(AGENTS, { id: copy.id });
        if (agent && agent.updatedAt > copy.updatedAt) {
            await workspace.dispatch('put-agent', { agent: sharedRow(agent, agent.updatedAt) });
        }
    }
}
export async function workspaceAgents(workspace, own) {
    const member = workspace.ourMemberId;
    const ownIds = new Set(own.map((agent) => agent.id));
    const listed = [];
    for (const agent of own) {
        const copy = await liveSharedAgent(workspace, agent.id);
        const shared = !!copy && (await ours(workspace, copy));
        listed.push({ ...agent, ownerMemberId: member ?? undefined, shared });
    }
    for (const copy of await workspace.view.find(AGENTS).toArray()) {
        const owner = copy.deletedAt || ownIds.has(copy.id) ? null : await ownerOf(workspace, copy);
        if (owner && !(member && b4a.equals(owner, member))) {
            listed.push({ ...copy, ownerMemberId: owner, shared: true });
        }
    }
    return listed;
}
export function accountPicks(account) {
    return {
        pick: (into, agentId) => copyAgent(account(), into, agentId),
        unpick: async () => { }
    };
}
function pickedRow(shared, workspace, updatedAt) {
    return { ...sharedRow(shared, updatedAt), sharedIn: workspace.key };
}
function sameContent(a, b) {
    return b4a.equals(encode('@qvac/agent', { ...a, updatedAt: 0 }), encode('@qvac/agent', { ...b, updatedAt: 0 }));
}
function restored(workspace, shared, held) {
    if (held && sameContent(held, pickedRow(shared, workspace, 0))) {
        return null;
    }
    return pickedRow(shared, workspace, Math.max(shared.updatedAt, (held?.updatedAt ?? 0) + 1));
}
function picked(copy, workspace) {
    return !!copy && !copy.deletedAt && !!copy.sharedIn && b4a.equals(copy.sharedIn, workspace.key);
}
function follows(workspace, into, copy) {
    return into.role === 'project' || (!!copy.sharedIn && b4a.equals(copy.sharedIn, workspace.key));
}
function inUse(into, agentId) {
    return into.view.findOne(ACTIVE_CHATS_BY_AGENT, { gte: { agentId }, lte: { agentId } });
}
function userOf(workspace, into) {
    if (into.role === 'project') {
        return { projectId: into.key };
    }
    return workspace.ourMemberId ? { memberId: workspace.ourMemberId } : null;
}
function refuse(refusal, agentId) {
    return refusal === 'AGENT_NOT_SHARED'
        ? new CoreError('AGENT_NOT_SHARED', [agentId])
        : new CoreError('CHAT_AGENT_UNAVAILABLE');
}
export async function pickAgent(scope, { into, agentId, refusal = 'AGENT_NOT_SHARED' }) {
    const { account, workspace } = scope;
    if (!agentId || !workspace) {
        return copyAgent(account, into, agentId);
    }
    const own = into.role === 'public' ? await account?.view.get(AGENTS, { id: agentId }) : null;
    if (own && !own.deletedAt) {
        return copyAgent(account, into, agentId);
    }
    const shared = await liveSharedAgent(workspace, agentId);
    if (!shared) {
        throw refuse(refusal, agentId);
    }
    const held = await into.view.get(AGENTS, { id: agentId });
    if (await heldByAnother(workspace, held, shared)) {
        throw new CoreError('CHAT_AGENT_UNAVAILABLE');
    }
    if (refusal === 'CHAT_AGENT_UNAVAILABLE' &&
        (await leftProject(into, { workspace, held, shared }))) {
        throw new CoreError('CHAT_AGENT_UNAVAILABLE');
    }
    const row = restored(workspace, shared, held);
    if (row) {
        await into.dispatch('put-agent', { agent: row });
    }
    const user = userOf(workspace, into);
    const userId = user?.memberId ?? user?.projectId;
    if (!user || !userId) {
        return;
    }
    if (user.memberId && (await theirs(workspace, shared))) {
        await scope.sharePublicSeed(workspace, shared.providerDeviceId);
    }
    const batch = workspace.batch();
    const picking = !(await workspace.view.get(AGENT_USERS, { agentId, userId }));
    if (picking) {
        batch.dispatch('put-agent-user', { agentId, ...user });
    }
    if (user.projectId) {
        await scope.shareProjectSeed(batch, { workspace, project: into, agent: shared, picking });
    }
    await batch.flush();
}
export async function unpickAgent(workspace, into, agentId) {
    const copy = await into.view.get(AGENTS, { id: agentId });
    if (!picked(copy, workspace) || (await inUse(into, agentId))) {
        return;
    }
    const at = Math.max(Date.now(), copy.updatedAt + 1);
    await into.dispatch('put-agent', { agent: { ...stripped(copy), deletedAt: at, updatedAt: at } });
    const user = userOf(workspace, into);
    const userId = user?.memberId ?? user?.projectId;
    if (user && userId && (await workspace.view.get(AGENT_USERS, { agentId, userId }))) {
        await workspace.dispatch('put-agent-user', { agentId, ...user, removed: true });
    }
}
export async function followPickedAgents(workspace, into) {
    for (const copy of await into.view.find(AGENTS).toArray()) {
        if (into.closing || workspace.closing)
            return;
        const shared = await workspace.view.get(AGENTS, { id: copy.id });
        if (!follows(workspace, into, copy)) {
            continue;
        }
        if (await ownerRemoved(workspace, copy, shared)) {
            if (!copy.deletedAt) {
                const at = copy.updatedAt + 1;
                await into.dispatch('put-agent', {
                    agent: { ...stripped(copy), deletedAt: at, updatedAt: at }
                });
            }
            continue;
        }
        if (!shared || (await unpicked(into, copy, shared))) {
            continue;
        }
        if (copy.deletedAt && (await leftProject(into, { workspace, held: copy, shared }))) {
            continue;
        }
        const row = restored(workspace, shared, copy);
        if (row) {
            await into.dispatch('put-agent', { agent: row });
        }
    }
}
async function ownerRemoved(workspace, copy, shared) {
    const host = await workspace.view.get(DEVICES, { id: copy.providerDeviceId });
    if (!host?.revoked || !host.memberId) {
        return false;
    }
    const owner = shared && (await ownerOf(workspace, shared));
    return !owner || !b4a.equals(owner, host.memberId);
}
async function heldByAnother(workspace, held, shared) {
    if (!held || b4a.equals(held.providerDeviceId, shared.providerDeviceId)) {
        return false;
    }
    if (await ownerRemoved(workspace, held, shared)) {
        return true;
    }
    const [was, now] = [await ownerOf(workspace, held), await ownerOf(workspace, shared)];
    return !was || !now || !b4a.equals(was, now);
}
async function leftProject(into, { workspace, held, shared }) {
    if (into.role !== 'project') {
        return false;
    }
    const host = held && (await into.view.get(DEVICES, { id: held.providerDeviceId }));
    if (held?.deletedAt && host?.revoked) {
        return true;
    }
    if (await workspace.view.get(AGENT_USERS, { agentId: shared.id, userId: into.key })) {
        return false;
    }
    const [owner, project] = [
        await ownerOf(workspace, shared),
        await readProject(workspace.view, into.key)
    ];
    return !owner || !project || !listsMember(project, owner);
}
async function unpicked(into, copy, shared) {
    return !!copy.deletedAt && (!!shared.deletedAt || !(await inUse(into, copy.id)));
}
export async function runDefinition(mesh, row) {
    const workspace = row && (await mesh.pickedFrom?.());
    if (!row || !workspace || !follows(workspace, mesh, row)) {
        return row;
    }
    const shared = await workspace.view.get(AGENTS, { id: row.id });
    if (!shared || shared.deletedAt || (await ownerRemoved(workspace, row, shared))) {
        return null;
    }
    return pickedRow(shared, workspace, row.updatedAt);
}
