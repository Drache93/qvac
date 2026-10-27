import { toolsetEnabled } from '@qvac/harness/lib/tools/toolsets.ts';
import { isMobilePlatform } from '@qvac/harness/lib/models/model-catalog.ts';
import { getAgent, isOrphaned } from '../../agent.js';
import { getChat } from '../../chat.js';
import { DEVICES } from '../../collections.js';
import { runDefinition } from '../../shared-agents.js';
import b4a from 'b4a';
export async function canIndexKnowledge(mesh, { deviceId, chatId, device }) {
    if (!chatId) {
        if (!deviceId || !mesh.writable) {
            return false;
        }
        return !device?.mobile() || !(await computerConnected(mesh, device.peers()));
    }
    return await canIndexChat(mesh, deviceId, chatId);
}
async function computerConnected(mesh, peers) {
    for (const peer of peers) {
        const row = await mesh.view.get(DEVICES, { id: b4a.from(peer, 'hex') });
        if (row && !row.revoked && !(row.platform && isMobilePlatform(row.platform))) {
            return true;
        }
    }
    return false;
}
async function canIndexChat(mesh, deviceId, chatId) {
    if (!deviceId) {
        return false;
    }
    const chat = await getChat(mesh, chatId);
    if (!chat) {
        return false;
    }
    const agent = await runDefinition(mesh, await getAgent(mesh, chat.agentId));
    if (!agent) {
        return false;
    }
    if (!toolsetEnabled('knowledge', agent.disabledToolsets)) {
        return false;
    }
    if (await isOrphaned(mesh, agent)) {
        return true;
    }
    return b4a.equals(agent.providerDeviceId, deviceId);
}
