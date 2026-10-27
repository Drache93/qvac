import b4a from 'b4a';
import { AGENT_USERS, AGENTS, DEVICES } from './collections.js';
import { readProjectHostKey } from './contract/project-host-keys.js';
import { readProjectDeviceKey } from './contract/project-device-keys.js';
import { listsMember, readProject, readProjectKey } from './contract/projects.js';
import { readMemberKey, upgradeMembers } from './contract/workspace.js';
import { sealToDevice } from './device-seal.js';
import { sealToMember } from './member-key.js';
export async function dueProjectKey(view, memberId, { projectId, seed }) {
    const key = await readMemberKey(view, memberId);
    const held = key && (await readProjectKey(view, projectId, memberId));
    if (!key || (held && b4a.equals(held.boxKey, key.boxKey))) {
        return null;
    }
    return { projectId, memberId, boxKey: key.boxKey, sealedSeed: sealToMember(seed, key.boxKey) };
}
async function usedBy(view, agent, seal) {
    const live = await view.get(AGENTS, { id: agent.id });
    if (!live || live.deletedAt || !b4a.equals(live.providerDeviceId, agent.providerDeviceId)) {
        return false;
    }
    return (!!seal.picking || !!(await view.get(AGENT_USERS, { agentId: agent.id, userId: seal.projectId })));
}
export async function dueProjectHostKey(view, agent, seal) {
    const { projectId, seed, project } = seal;
    const deviceId = agent.providerDeviceId;
    const row = await readProject(view, projectId);
    const host = await view.get(DEVICES, { id: deviceId });
    const member = host && !host.revoked ? host.memberId : null;
    const inProject = await project.get(DEVICES, { id: deviceId });
    if (!row || !member || inProject || listsMember(row, member)) {
        return null;
    }
    if (!(await usedBy(view, agent, seal))) {
        return null;
    }
    if (await readProjectHostKey(view, projectId, deviceId)) {
        return null;
    }
    return { projectId, deviceId, agentId: agent.id, sealedSeed: sealToDevice(seed, deviceId) };
}
export async function dueProjectDeviceKeys(view, row, seed) {
    if (!row.groupId) {
        return [];
    }
    const counted = (await upgradeMembers(view)).filter((id) => listsMember(row, id));
    const due = [];
    for await (const { id, memberId, revoked } of view.find(DEVICES)) {
        const listed = memberId && counted.some((member) => b4a.equals(member, memberId));
        if (!memberId || !listed || revoked || (await readProjectDeviceKey(view, row.id, id))) {
            continue;
        }
        due.push({ projectId: row.id, deviceId: id, memberId, sealedSeed: sealToDevice(seed, id) });
    }
    return due;
}
