import { liveDeviceForWriter, trackActivity } from './activity.js';
import { meshKind } from './mesh-kind.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import { isWorkspace, readMemberKey, upgradeMembers } from './workspace.js';
import { dropMemberAgentUses, dropUser } from './agents.js';
import { dropMemberHostKeys, dropProjectHostKeys, readProjectHostKey } from './project-host-keys.js';
import { dropListingDeviceKeys, dropProjectDeviceKeys, readProjectDeviceKey } from './project-device-keys.js';
import b4a from 'b4a';
import { SEALED_SEED_BYTES } from '../device-seal.js';
import { AGENT_USERS, AGENTS, CHAT_GROUPS, DEVICES, MESH_FOUNDERS, PROJECT_DEVICE_KEYS, PROJECT_HOST_KEYS, PROJECT_KEYS, PROJECT_MEMBERS, PROJECTS } from '../collections.js';
export const UNGROUPED = '@qvac/ungrouped';
export function readProject(tx, id) {
    return tx.get(PROJECTS, { id });
}
export function readProjectKey(tx, projectId, memberId) {
    return tx.get(PROJECT_KEYS, { projectId, memberId });
}
async function dropProjectKeys(tx, projectId) {
    const range = { gte: { projectId }, lte: { projectId } };
    for (const row of await tx.find(PROJECT_KEYS, range).toArray()) {
        await tx.delete(PROJECT_KEYS, { projectId, memberId: row.memberId });
    }
}
export async function dropMemberProjectKeys(tx, memberId) {
    for (const row of await tx.find(PROJECT_KEYS).toArray()) {
        if (b4a.equals(row.memberId, memberId)) {
            await tx.delete(PROJECT_KEYS, { projectId: row.projectId, memberId });
        }
    }
}
export function listsMember(project, memberId) {
    return (project.memberIds ?? []).some((id) => b4a.equals(id, memberId));
}
export function listedProject(project, memberId) {
    return !project.deletedAt && listsMember(project, memberId);
}
export function projectMember(tx, memberId) {
    return tx.get(PROJECT_MEMBERS, { memberId });
}
export async function inProject(tx, memberId) {
    return (await projectMember(tx, memberId)) !== null;
}
export async function addedSince(tx, memberId, at) {
    return ((await projectMember(tx, memberId))?.addedAt ?? 0) > at;
}
export async function projectRules(tx) {
    return (await rulesVersion(tx)) >= WORKSPACES_RULES && (await meshKind(tx)) === 'project';
}
export async function outsideProject(tx, memberId) {
    if (!(await projectRules(tx))) {
        return false;
    }
    return !memberId || !(await inProject(tx, memberId));
}
export async function liveMember(tx, memberId, since = -1) {
    for await (const device of tx.find(DEVICES)) {
        const theirs = device.memberId && b4a.equals(device.memberId, memberId);
        if (!device.revoked && theirs && device.joinedAt > since) {
            return true;
        }
    }
    return false;
}
export async function signerMember({ tx, node }) {
    return (await liveDeviceForWriter(tx, node.key))?.memberId ?? null;
}
export async function projectOfGroup(tx, groupId) {
    for await (const row of tx.find(PROJECTS)) {
        if (row.groupId === groupId)
            return row;
    }
    return null;
}
async function namesGroup(tx, groupId) {
    return groupId === UNGROUPED || !!(await tx.get(CHAT_GROUPS, { id: groupId }));
}
async function putProject({ project }, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-project dropped: projects are listed in a workspace');
        return;
    }
    const signer = await signerMember(context);
    if (!signer) {
        log?.warn('contract', 'put-project dropped: the writer speaks for no member here');
        return;
    }
    if (b4a.equals(project.id, context.host.key)) {
        log?.warn('contract', 'put-project dropped: the id is the workspace itself');
        return;
    }
    const existing = await readProject(tx, project.id);
    if (existing) {
        log?.debug('contract', 'put-project dropped: the project is already listed');
        return;
    }
    if (project.groupId && !(await namesGroup(tx, project.groupId))) {
        log?.warn('contract', 'put-project dropped: the groupId names no chat-group here');
        return;
    }
    if (project.groupId && (await projectOfGroup(tx, project.groupId))) {
        log?.debug('contract', 'put-project dropped: the group already has its project');
        return;
    }
    const created = {
        ...project,
        memberIds: [signer],
        createdBy: signer,
        deletedAt: undefined
    };
    await tx.insert(PROJECTS, created);
    return created;
}
async function setProjectListing({ projectId, memberId, removed, removedAt }, context) {
    const { tx, log } = context;
    const existing = await readProject(tx, projectId);
    if (!existing || existing.deletedAt) {
        log?.debug('contract', 'set-project-listing dropped: unknown or deleted project');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !listsMember(existing, signer)) {
        log?.warn('contract', "set-project-listing dropped: only the project's members change it");
        return;
    }
    if (!removed && !(await liveMember(tx, memberId))) {
        log?.warn('contract', 'set-project-listing dropped: not a member of this workspace');
        return;
    }
    if (removed && removedAt && (await liveMember(tx, memberId, removedAt))) {
        log?.debug('contract', 'set-project-listing dropped: the member came back after the removal');
        return;
    }
    const others = (existing.memberIds ?? []).filter((id) => !b4a.equals(id, memberId));
    const memberIds = removed ? others : [...others, memberId];
    const next = { ...existing, memberIds };
    const listed = memberIds.length === 0 ? await tombstone(next, context) : next;
    await tx.insert(PROJECTS, listed);
    if (removed) {
        await tx.delete(PROJECT_KEYS, { projectId, memberId });
        await dropListingDeviceKeys(tx, projectId, memberId);
        await dropMemberAgentUses(tx, memberId, projectId);
    }
    await dropMemberHostKeys(tx, projectId, memberId);
    return listed;
}
async function tombstone(project, { tx, node }) {
    await dropUser(tx, project.id);
    await dropProjectKeys(tx, project.id);
    await dropProjectHostKeys(tx, project.id);
    await dropProjectDeviceKeys(tx, project.id);
    return { ...project, deletedAt: node.timestamp };
}
async function deleteProject({ projectId }, context) {
    const { tx, host, log } = context;
    const existing = await readProject(tx, projectId);
    if (!existing || existing.deletedAt || b4a.equals(projectId, host.key)) {
        log?.debug('contract', 'delete-project dropped: unknown or already deleted project');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !listsMember(existing, signer)) {
        log?.warn('contract', "delete-project dropped: only the project's members delete it");
        return;
    }
    const deleted = await tombstone(existing, context);
    await tx.insert(PROJECTS, deleted);
    return deleted;
}
async function putProjectKey(op, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-project-key dropped: not a workspace');
        return;
    }
    const project = await readProject(tx, op.projectId);
    if (!project || project.deletedAt) {
        log?.debug('contract', 'put-project-key dropped: unknown or deleted project');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !listsMember(project, signer) || !listsMember(project, op.memberId)) {
        log?.warn('contract', 'put-project-key dropped: the project lists not both signer and member');
        return;
    }
    const memberKey = await readMemberKey(tx, op.memberId);
    if (!memberKey || !b4a.equals(memberKey.boxKey, op.boxKey)) {
        log?.debug('contract', "put-project-key dropped: not sealed to the member's box key");
        return;
    }
    if (op.sealedSeed.byteLength !== SEALED_SEED_BYTES) {
        log?.warn('contract', 'put-project-key dropped: not a sealed seed');
        return;
    }
    const held = await readProjectKey(tx, op.projectId, op.memberId);
    if (held && b4a.equals(held.boxKey, op.boxKey)) {
        return;
    }
    const row = {
        projectId: op.projectId,
        memberId: op.memberId,
        boxKey: op.boxKey,
        sealedSeed: op.sealedSeed
    };
    await tx.insert(PROJECT_KEYS, row);
    return row;
}
async function putProjectHostKey(op, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-project-host-key dropped: not a workspace');
        return;
    }
    const project = await readProject(tx, op.projectId);
    if (!project || project.deletedAt) {
        log?.debug('contract', 'put-project-host-key dropped: unknown or deleted project');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !listsMember(project, signer)) {
        log?.warn('contract', "put-project-host-key dropped: only the project's members seal to a host");
        return;
    }
    const agent = await tx.get(AGENTS, { id: op.agentId });
    if (!agent || agent.deletedAt || !b4a.equals(agent.providerDeviceId, op.deviceId)) {
        log?.debug('contract', "put-project-host-key dropped: not the live agent's host");
        return;
    }
    if (!(await tx.get(AGENT_USERS, { agentId: op.agentId, userId: op.projectId }))) {
        log?.debug('contract', 'put-project-host-key dropped: the project does not use the agent');
        return;
    }
    const device = await tx.get(DEVICES, { id: op.deviceId });
    const member = device && !device.revoked ? device.memberId : null;
    if (!member || listsMember(project, member)) {
        log?.debug('contract', 'put-project-host-key dropped: a revoked host, or a listed member');
        return;
    }
    if (op.sealedSeed.byteLength !== SEALED_SEED_BYTES) {
        log?.warn('contract', 'put-project-host-key dropped: not a sealed seed');
        return;
    }
    if (await readProjectHostKey(tx, op.projectId, op.deviceId)) {
        return;
    }
    const row = {
        projectId: op.projectId,
        deviceId: op.deviceId,
        agentId: op.agentId,
        sealedSeed: op.sealedSeed
    };
    await tx.insert(PROJECT_HOST_KEYS, row);
    return row;
}
async function countedDevice(tx, { memberId, deviceId }) {
    const counted = (await upgradeMembers(tx)).some((id) => b4a.equals(id, memberId));
    const device = counted ? await tx.get(DEVICES, { id: deviceId }) : null;
    return !!device?.memberId && !device.revoked && b4a.equals(device.memberId, memberId);
}
async function putProjectDeviceKey(op, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-project-device-key dropped: not a workspace');
        return;
    }
    const project = await readProject(tx, op.projectId);
    if (!project || project.deletedAt || !project.groupId) {
        log?.debug('contract', 'put-project-device-key dropped: no live upgraded project');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !listsMember(project, signer) || !listsMember(project, op.memberId)) {
        log?.warn('contract', 'put-project-device-key dropped: the project lists not both signer and member');
        return;
    }
    if (!(await countedDevice(tx, op))) {
        log?.debug('contract', 'put-project-device-key dropped: no live device of a counted member');
        return;
    }
    if (op.sealedSeed.byteLength !== SEALED_SEED_BYTES) {
        log?.warn('contract', 'put-project-device-key dropped: not a sealed seed');
        return;
    }
    if (await readProjectDeviceKey(tx, op.projectId, op.deviceId)) {
        return;
    }
    const row = {
        projectId: op.projectId,
        deviceId: op.deviceId,
        memberId: op.memberId,
        sealedSeed: op.sealedSeed
    };
    await tx.insert(PROJECT_DEVICE_KEYS, row);
    return row;
}
async function putProjectMember({ memberId, addedAt }, context) {
    const { tx, host, log } = context;
    if ((await meshKind(tx)) !== 'project') {
        log?.warn('contract', 'put-project-member dropped: not a project');
        return;
    }
    if (host.genesis) {
        const founder = await tx.get(MESH_FOUNDERS, { id: 'mesh' });
        if (!founder || !b4a.equals(founder.memberId, memberId)) {
            log?.warn('contract', 'put-project-member dropped: a genesis lists only its founder');
            return;
        }
    }
    else {
        const signer = await signerMember(context);
        if (!signer || !(await inProject(tx, signer))) {
            log?.warn('contract', "put-project-member dropped: only the project's members add one");
            return;
        }
    }
    const row = { memberId, addedAt };
    await tx.insert(PROJECT_MEMBERS, row);
    return row;
}
export function registerProjectRoutes(router) {
    router.add('@qvac/put-project', trackActivity(putProject));
    router.add('@qvac/set-project-listing', trackActivity(setProjectListing));
    router.add('@qvac/put-project-member', trackActivity(putProjectMember));
    router.add('@qvac/delete-project', trackActivity(deleteProject));
    router.add('@qvac/put-project-key', trackActivity(putProjectKey));
    router.add('@qvac/put-project-host-key', trackActivity(putProjectHostKey));
    router.add('@qvac/put-project-device-key', trackActivity(putProjectDeviceKey));
}
