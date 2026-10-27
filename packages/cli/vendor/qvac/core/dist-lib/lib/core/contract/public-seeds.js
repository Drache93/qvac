import b4a from 'b4a';
import { AGENT_USERS, AGENTS_BY_PROVIDER, PUBLIC_SEEDS } from '../collections.js';
export function readPublicSeed(tx, memberId, deviceId) {
    return tx.get(PUBLIC_SEEDS, { memberId, deviceId });
}
export async function liveAgentsOn(tx, providerDeviceId) {
    const range = { gte: { providerDeviceId }, lte: { providerDeviceId } };
    const agents = await tx.find(AGENTS_BY_PROVIDER, range).toArray();
    return agents.filter((agent) => !agent.deletedAt);
}
export async function hostsLiveAgent(tx, deviceId) {
    return (await liveAgentsOn(tx, deviceId)).length > 0;
}
export async function dropMemberSeeds(tx, memberId) {
    const range = { gte: { memberId }, lte: { memberId } };
    for (const row of await tx.find(PUBLIC_SEEDS, range).toArray()) {
        await tx.delete(PUBLIC_SEEDS, { memberId, deviceId: row.deviceId });
    }
}
async function seedsSealedTo(tx, deviceId) {
    const rows = await tx.find(PUBLIC_SEEDS).toArray();
    return rows.filter((row) => b4a.equals(row.deviceId, deviceId));
}
export async function dropDeviceSeeds(tx, deviceId) {
    for (const row of await seedsSealedTo(tx, deviceId)) {
        await tx.delete(PUBLIC_SEEDS, { memberId: row.memberId, deviceId });
    }
}
export async function usesAny(tx, agents, userId) {
    for (const agent of agents) {
        if (await tx.get(AGENT_USERS, { agentId: agent.id, userId }))
            return true;
    }
    return false;
}
export async function pruneHostSeeds(tx, deviceId) {
    const agents = await liveAgentsOn(tx, deviceId);
    for (const row of await seedsSealedTo(tx, deviceId)) {
        if (!(await usesAny(tx, agents, row.memberId))) {
            await tx.delete(PUBLIC_SEEDS, { memberId: row.memberId, deviceId });
        }
    }
}
