import b4a from 'b4a';
import { liveDeviceForWriter, trackActivity } from './activity.js';
import { dropMemberProjectKeys, listedProject, readProject, signerMember } from './projects.js';
import { dropMemberDeviceKeys } from './project-device-keys.js';
import { evictHosts } from './agent-join.js';
import { isWorkspace } from './workspace.js';
import { meshKind } from './mesh-kind.js';
import { AGENT_USERS, AGENTS, DEVICES, MEMBER_KEYS } from '../collections.js';
import { dropMemberSeeds, pruneHostSeeds } from './public-seeds.js';
import { pruneProjectHostKeys } from './project-host-keys.js';
async function memberOfDevice(tx, id) {
    return (await tx.get(DEVICES, { id }))?.memberId ?? null;
}
async function ownerWrites({ tx, node }, devices) {
    const signer = (await liveDeviceForWriter(tx, node.key))?.memberId;
    for (const id of devices) {
        const owner = await memberOfDevice(tx, id);
        if (!signer || !owner || !b4a.equals(owner, signer)) {
            return false;
        }
    }
    return true;
}
async function pruneHost(tx, deviceId) {
    await pruneHostSeeds(tx, deviceId);
    await pruneProjectHostKeys(tx, deviceId);
}
async function dropUsers(tx, agentId) {
    const range = { gte: { agentId }, lte: { agentId } };
    for (const row of await tx.find(AGENT_USERS, range).toArray()) {
        await tx.delete(AGENT_USERS, { agentId, userId: row.userId });
    }
}
async function userWriter(op, context) {
    const signer = await signerMember(context);
    const userId = op.memberId ?? op.projectId;
    if (!signer || !userId || (op.memberId && op.projectId)) {
        return null;
    }
    if (op.memberId) {
        return b4a.equals(signer, op.memberId) ? userId : null;
    }
    const project = await readProject(context.tx, userId);
    return project && listedProject(project, signer) ? userId : null;
}
async function putAgentUser(op, context) {
    const { tx, log } = context;
    const userId = await userWriter(op, context);
    if (!userId) {
        log?.warn('contract', 'put-agent-user dropped: the writer does not speak for that user');
        return;
    }
    const key = { agentId: op.agentId, userId };
    if (op.removed) {
        await tx.delete(AGENT_USERS, key);
        const agent = await tx.get(AGENTS, { id: op.agentId });
        if (agent) {
            await pruneHost(tx, agent.providerDeviceId);
        }
        return true;
    }
    const agent = await tx.get(AGENTS, { id: op.agentId });
    if (!agent || agent.deletedAt) {
        log?.debug('contract', 'put-agent-user dropped: no shared agent by that id');
        return;
    }
    const row = { ...key, project: !!op.projectId };
    await tx.insert(AGENT_USERS, row);
    return row;
}
export async function dropMemberAgents(tx, memberId) {
    if (!(await isWorkspace(tx))) {
        return;
    }
    const owned = [];
    for await (const agent of tx.find(AGENTS)) {
        const owner = agent.deletedAt ? null : await memberOfDevice(tx, agent.providerDeviceId);
        if (owner && b4a.equals(owner, memberId)) {
            owned.push(agent);
        }
    }
    for (const agent of owned) {
        await tx.delete(AGENTS, { id: agent.id });
        await dropUsers(tx, agent.id);
        await pruneHost(tx, agent.providerDeviceId);
    }
    await dropUser(tx, memberId);
    await dropMemberSeeds(tx, memberId);
    await tx.delete(MEMBER_KEYS, { memberId });
    await dropMemberProjectKeys(tx, memberId);
    await dropMemberDeviceKeys(tx, memberId);
}
export async function dropMemberCopies(tx, deviceIds, at) {
    if ((await meshKind(tx)) !== 'project') {
        return;
    }
    for (const agent of await tx.find(AGENTS).toArray()) {
        const theirs = deviceIds.some((id) => b4a.equals(id, agent.providerDeviceId));
        if (theirs && agent.sharedIn && !agent.deletedAt) {
            const stamp = Math.max(at, agent.updatedAt + 1);
            await tx.insert(AGENTS, { ...agent, deletedAt: stamp, updatedAt: stamp });
        }
    }
}
export async function dropUser(tx, userId) {
    for (const row of await tx.find(AGENT_USERS).toArray()) {
        if (b4a.equals(row.userId, userId)) {
            await tx.delete(AGENT_USERS, { agentId: row.agentId, userId });
        }
    }
}
export async function dropMemberAgentUses(tx, memberId, userId) {
    for (const row of await tx.find(AGENT_USERS).toArray()) {
        const agent = b4a.equals(row.userId, userId) && (await tx.get(AGENTS, { id: row.agentId }));
        const owner = agent && (await memberOfDevice(tx, agent.providerDeviceId));
        if (owner && b4a.equals(owner, memberId)) {
            await tx.delete(AGENT_USERS, { agentId: row.agentId, userId });
        }
    }
}
export function registerAgentRoutes(router) {
    router.add('@qvac/put-agent', trackActivity(async ({ agent }, context) => {
        const { tx, log } = context;
        const existing = await tx.get(AGENTS, { id: agent.id });
        if (existing && existing.updatedAt > agent.updatedAt) {
            log?.debug('contract', 'put-agent dropped: stale updatedAt', { id: agent.id });
            return;
        }
        const devices = existing
            ? [agent.providerDeviceId, existing.providerDeviceId]
            : [agent.providerDeviceId];
        if ((await isWorkspace(tx)) && !(await ownerWrites(context, devices))) {
            log?.warn('contract', 'put-agent dropped: only its owner writes a shared agent', {
                id: agent.id
            });
            return;
        }
        await tx.insert(AGENTS, agent);
        const workspace = await isWorkspace(tx);
        if (agent.deletedAt && workspace) {
            await dropUsers(tx, agent.id);
        }
        const moved = existing && !b4a.equals(existing.providerDeviceId, agent.providerDeviceId);
        if (workspace && existing && (agent.deletedAt || moved)) {
            await pruneHost(tx, existing.providerDeviceId);
        }
        await evictHosts(context, agent);
        log?.debug('contract', existing ? 'agent updated' : 'agent created', { id: agent.id });
        return agent;
    }));
    router.add('@qvac/put-agent-user', trackActivity(putAgentUser));
    router.add('@qvac/reindex-agents', async ({ agentIds }, { tx }) => {
        for (const id of agentIds ?? []) {
            const agent = await tx.get(AGENTS, { id });
            if (agent) {
                await tx.insert(AGENTS, { ...agent, version: undefined });
            }
        }
    });
    router.add('@qvac/migrate-agent-catalog', trackActivity(async ({ agent: healthAssistant }, { tx, log }) => {
        if (await tx.get(AGENTS, { id: healthAssistant.id })) {
            return false;
        }
        const legacyDefault = (await tx.find(AGENTS).toArray()).find((agent) => !agent.deletedAt && agent.isDefault && agent.name === 'Agent');
        if (legacyDefault) {
            await tx.insert(AGENTS, {
                ...legacyDefault,
                version: undefined,
                name: 'QV.AC'
            });
        }
        await tx.insert(AGENTS, healthAssistant);
        log?.info('contract', 'agent catalog migrated');
        return true;
    }));
}
