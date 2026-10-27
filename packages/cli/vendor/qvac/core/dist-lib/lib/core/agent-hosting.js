import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { readProjectHostKey } from './contract/project-host-keys.js';
import { listedProject, readProject } from './contract/projects.js';
import { liveAgentsOn, readPublicSeed } from './contract/public-seeds.js';
import { signWriterClaim } from './device-attestation.js';
import { openSealedToDevice } from './device-seal.js';
import { isRecord } from '../guards.js';
import { AGENT_HOSTS, AGENT_USERS, AGENTS } from './collections.js';
export function agentJoin(mesh, { device, writerKey, agentId, at }) {
    const deviceId = device.publicKey;
    const binding = { meshPublicKey: mesh.publicKey, deviceId, writerKey, joinedAt: at };
    return {
        agentId,
        deviceId,
        at,
        deviceSignature: signWriterClaim(device.secretKey, binding),
        signature: mesh.sign(writerKey)
    };
}
async function targetOf(workspace, { userId, project }, device) {
    const ours = workspace.ourMemberId;
    if (project) {
        const row = await readProject(workspace.view, userId);
        if (!row || row.deletedAt || (ours && listedProject(row, ours))) {
            return null;
        }
        const sealed = await readProjectHostKey(workspace.view, row.id, device.publicKey);
        const seed = sealed && openSealedToDevice(sealed.sealedSeed, device);
        return seed && { meshKey: row.id, seed, role: 'project' };
    }
    if (!ours || b4a.equals(userId, ours)) {
        return null;
    }
    const row = await readPublicSeed(workspace.view, userId, device.publicKey);
    const seed = row && openSealedToDevice(row.sealedSeed, device);
    return seed && { meshKey: row.publicMeshKey, seed, role: 'public' };
}
export async function hostTargets(workspace, device) {
    const targets = new Map();
    for (const agent of await liveAgentsOn(workspace.view, device.publicKey)) {
        const range = { gte: { agentId: agent.id }, lte: { agentId: agent.id } };
        for (const user of await workspace.view.find(AGENT_USERS, range).toArray()) {
            const target = await targetOf(workspace, user, device);
            const id = target && b4a.toHex(target.meshKey);
            if (target && id) {
                const held = targets.get(id) ?? { ...target, agentIds: [] };
                targets.set(id, { ...held, agentIds: [...held.agentIds, agent.id] });
            }
        }
    }
    return [...targets.values()];
}
export async function hostState(mesh, agentId, deviceId) {
    const writerKey = mesh.localWriterKey;
    if (await mesh.view.get(AGENT_HOSTS, { writerKey, agentId })) {
        return 'hosting';
    }
    const copy = await mesh.view.get(AGENTS, { id: agentId });
    const live = copy && !copy.deletedAt && copy.sharedIn;
    return !copy || (live && b4a.equals(copy.providerDeviceId, deviceId)) ? 'due' : 'held';
}
export function hostRecordKey(meshKey) {
    return `agent-host/${b4a.toHex(meshKey)}`;
}
export function isHostRecord(value) {
    return isRecord(value) && typeof value.writerSeed === 'string';
}
export function freshHostRecord() {
    return { writerSeed: `host-${b4a.toHex(crypto.randomBytes(8))}` };
}
