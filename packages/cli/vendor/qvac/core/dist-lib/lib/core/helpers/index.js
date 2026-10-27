import { randomId } from '../id.js';
import b4a from 'b4a';
export const DEFAULT_AGENT_NAME = 'QV.AC';
const DEFAULT_AGENT_BIO = 'You are a helpful local assistant. Be clear, practical, and concise.';
const DEFAULT_AGENT_ICON = 'artificial-intelligence';
const DEFAULT_FIRST_CHAT_TITLE = 'New Chat';
function seedableAgent(agent) {
    return {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        providerDeviceId: agent.providerDeviceId,
        modelName: agent.modelName,
        reasoning: agent.reasoning,
        enabledSkills: agent.enabledSkills,
        enabledTools: agent.enabledTools,
        installedSkills: agent.installedSkills,
        isDefault: agent.isDefault,
        iconName: agent.iconName,
        toolsScope: agent.toolsScope,
        skillsScope: agent.skillsScope,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt
    };
}
function seedableChat(chat) {
    return {
        id: chat.id,
        agentId: chat.agentId,
        title: chat.title,
        webSearchEnabled: chat.webSearchEnabled,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
    };
}
export function buildDefaultSeed(device, blindPeerKeys) {
    const now = Date.now();
    const agentId = randomId();
    return {
        agent: seedableAgent({
            id: agentId,
            name: DEFAULT_AGENT_NAME,
            bio: DEFAULT_AGENT_BIO,
            providerDeviceId: device.id,
            modelName: device.recommendedModelName,
            reasoning: 'inherit',
            enabledSkills: [],
            enabledTools: [],
            installedSkills: [],
            isDefault: true,
            iconName: DEFAULT_AGENT_ICON,
            toolsScope: 'all',
            skillsScope: 'selected',
            createdAt: now,
            updatedAt: now
        }),
        chat: seedableChat({
            id: randomId(),
            agentId,
            title: DEFAULT_FIRST_CHAT_TITLE,
            webSearchEnabled: true,
            createdAt: now,
            updatedAt: now
        }),
        blindPeers: blindPeerKeys.map((key) => ({ key }))
    };
}
export function isOwnRevokedRow(mesh, device) {
    return (device.revoked === true &&
        !!device.writerKey &&
        b4a.equals(device.writerKey, mesh.localWriterKey));
}
export function isKickedRow(device) {
    return (device.revoked === true &&
        !(device.writerKey && device.revokedBy && b4a.equals(device.revokedBy, device.writerKey)));
}
export function isOwnKickedRow(mesh, device) {
    return isOwnRevokedRow(mesh, device) && isKickedRow(device);
}
