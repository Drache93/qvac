import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import { devicesByWriterKey, liveDeviceForWriter, trackActivity } from './activity.js';
import { verifyWriterClaim } from '../device-attestation.js';
import { projectRules } from './projects.js';
import { AGENT_HOSTS, AGENTS, DEVICES } from '../collections.js';
export function hostRowsOf(db, writerKey) {
    return db.find(AGENT_HOSTS, { gte: { writerKey }, lte: { writerKey } }).toArray();
}
export async function hostedDevice(db, deviceId) {
    for await (const row of db.find(AGENT_HOSTS)) {
        if (b4a.equals(row.deviceId, deviceId))
            return true;
    }
    return false;
}
export async function dropHostRows(tx, writerKey) {
    for (const { agentId } of await hostRowsOf(tx, writerKey)) {
        await tx.delete(AGENT_HOSTS, { writerKey, agentId });
    }
}
export async function releaseHostedDevice({ tx, host }, deviceId, keep) {
    const held = [];
    for await (const row of tx.find(AGENT_HOSTS)) {
        if (b4a.equals(row.deviceId, deviceId)) {
            held.push(row);
        }
    }
    const writers = new Map();
    for (const { writerKey, agentId } of held) {
        await tx.delete(AGENT_HOSTS, { writerKey, agentId });
        writers.set(b4a.toHex(writerKey), writerKey);
    }
    for (const writerKey of writers.values()) {
        if (!b4a.equals(writerKey, keep)) {
            await host.removeWriter(writerKey);
        }
    }
}
export async function evictHosts({ tx, host }, agent) {
    if (await projectRules(tx)) {
        return;
    }
    const gone = [];
    for await (const row of tx.find(AGENT_HOSTS)) {
        if (row.agentId === agent.id &&
            (agent.deletedAt || !b4a.equals(row.deviceId, agent.providerDeviceId))) {
            gone.push(row);
        }
    }
    for (const { writerKey, agentId } of gone) {
        await tx.delete(AGENT_HOSTS, { writerKey, agentId });
        const serving = (await hostRowsOf(tx, writerKey)).length > 0;
        if (!serving && !(await liveDeviceForWriter(tx, writerKey))) {
            await host.removeWriter(writerKey);
        }
    }
}
async function boundToDevice(tx, writerKey) {
    for await (const _device of devicesByWriterKey(tx, writerKey)) {
        return true;
    }
    return false;
}
async function refusal(op, { tx, node, meshPublicKey }) {
    let seeded = false;
    try {
        seeded = crypto.verify(node.key, op.signature, meshPublicKey);
    }
    catch {
        seeded = false;
    }
    if (!seeded) {
        return 'invalid writer-claim signature';
    }
    const binding = { meshPublicKey, deviceId: op.deviceId, writerKey: node.key, joinedAt: op.at };
    if (!verifyWriterClaim(op.deviceSignature, binding)) {
        return 'the device did not sign for this writer key';
    }
    if (await tx.get(DEVICES, { id: op.deviceId })) {
        return 'the device id is a device of this mesh';
    }
    if (await boundToDevice(tx, node.key)) {
        return "the writer is a device's";
    }
    const [held] = await hostRowsOf(tx, node.key);
    if (held && !b4a.equals(held.deviceId, op.deviceId)) {
        return 'the writer hosts as another device';
    }
    const agent = await tx.get(AGENTS, { id: op.agentId });
    if (!agent || agent.deletedAt || !agent.sharedIn) {
        return 'no live picked copy of the agent';
    }
    return b4a.equals(agent.providerDeviceId, op.deviceId) ? null : 'the copy names another device';
}
export function registerAgentJoinRoutes(router) {
    router.add('@qvac/agent-join', trackActivity(async (op, context) => {
        const why = await refusal(op, context);
        if (why) {
            context.log?.warn('contract', `agent-join dropped: ${why}`, { agentId: op.agentId });
            return;
        }
        const row = { writerKey: context.node.key, deviceId: op.deviceId, agentId: op.agentId };
        await context.host.addWriter(context.node.key);
        await context.tx.insert(AGENT_HOSTS, row);
        return row;
    }));
}
