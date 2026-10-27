import { cancelRunsForAgent, softDeleteChatsForAgent } from './chat.js';
import { randomId } from './id.js';
import { softDeleteToolConfigsForAgent } from './tool-configs.js';
import b4a from 'b4a';
import { CoreError } from '../errors.js';
import { ACTIVE_AGENTS, AGENTS, AGENTS_BY_PROVIDER, DEFAULT_AGENTS, DEVICES } from './collections.js';
const DEFAULT_ICON_NAME = 'artificial-intelligence';
export function allTools() {
    return { toolsScope: 'all', enabledTools: [] };
}
function mergeSkills(base, enabled) {
    return Array.from(new Set([...(base ?? []), ...(enabled ?? [])]));
}
function patch(next, current) {
    return next === null || next === undefined ? current : next;
}
export async function listAgents(store, providerDeviceId) {
    const snap = store.view.snapshot();
    try {
        if (providerDeviceId) {
            return await snap
                .find(AGENTS_BY_PROVIDER, providerRange(providerDeviceId))
                .toArray();
        }
        return await snap.find(ACTIVE_AGENTS).toArray();
    }
    finally {
        await snap.close();
    }
}
export async function getDefaultAgent(store, providerDeviceId) {
    const snap = store.view.snapshot();
    try {
        const range = providerDeviceId ? providerRange(providerDeviceId) : {};
        return await snap.findOne(DEFAULT_AGENTS, range);
    }
    finally {
        await snap.close();
    }
}
function providerRange(providerDeviceId) {
    return { gte: { providerDeviceId }, lte: { providerDeviceId } };
}
export async function getAgent(store, id) {
    const snap = store.view.snapshot();
    try {
        const agent = await snap.get(AGENTS, { id });
        return agent;
    }
    finally {
        await snap.close();
    }
}
export async function isOrphaned(store, agent) {
    const snap = store.view.snapshot();
    try {
        const device = await snap.get(DEVICES, { id: agent.providerDeviceId });
        return !device || device.revoked === true;
    }
    finally {
        await snap.close();
    }
}
export async function liveProviderIds(store) {
    const live = new Set();
    const snap = store.view.snapshot();
    try {
        for await (const device of snap.find(DEVICES)) {
            if (!device.revoked) {
                live.add(b4a.toHex(device.id));
            }
        }
        return live;
    }
    finally {
        await snap.close();
    }
}
export async function mustGetAgent(store, id) {
    const agent = await getAgent(store, id);
    if (!agent) {
        throw new CoreError('AGENT_NOT_FOUND', [id]);
    }
    return agent;
}
export async function mustGetActiveAgent(store, id) {
    const agent = await mustGetAgent(store, id);
    if (agent.deletedAt) {
        throw new CoreError('AGENT_NOT_FOUND', [id]);
    }
    return agent;
}
export async function landingAgentId(target, sourceAgentId, agentId) {
    if (agentId) {
        return (await mustGetActiveAgent(target, agentId)).id;
    }
    return (await getDefaultAgent(target))?.id ?? sourceAgentId;
}
export async function createAgent(store, input) {
    const now = Date.now();
    const enabledSkills = input.enabledSkills ?? [];
    const installedBase = input.installedSkills ?? enabledSkills;
    const agent = {
        id: randomId(),
        name: input.name,
        bio: input.bio,
        providerDeviceId: input.providerDeviceId,
        modelName: input.modelName,
        reasoning: input.reasoning ?? 'inherit',
        enabledSkills,
        ...allTools(),
        installedSkills: mergeSkills(installedBase, enabledSkills),
        isDefault: input.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined,
        imageModelChoice: input.imageModelChoice ?? undefined,
        kvCacheK: input.kvCacheK ?? undefined,
        kvCacheV: input.kvCacheV ?? undefined,
        iconName: input.iconName ?? DEFAULT_ICON_NAME,
        ctxSize: input.ctxSize || undefined,
        skillsScope: input.skillsScope ?? 'selected',
        imageSteps: input.imageSteps || undefined,
        imageWidth: input.imageWidth || undefined,
        imageHeight: input.imageHeight || undefined,
        approvalMode: input.approvalMode === 'skip-all' ? 'skip-all' : 'ask',
        disabledToolsets: input.disabledToolsets ?? []
    };
    await store.dispatch('put-agent', { agent });
    return agent;
}
async function ownDefaultAgents(store) {
    const self = store.ourDeviceId;
    const ours = store.ourMemberId;
    const own = [];
    const snap = store.view.snapshot();
    try {
        for await (const agent of snap.find(AGENTS)) {
            if (agent.deletedAt || !agent.isDefault || !agent.providerDeviceId) {
                continue;
            }
            const host = await snap.get(DEVICES, { id: agent.providerDeviceId });
            if (!host || host.revoked) {
                continue;
            }
            if ((self && b4a.equals(self, host.id)) ||
                (ours && host.memberId && b4a.equals(host.memberId, ours))) {
                own.push(agent);
            }
        }
        return own;
    }
    finally {
        await snap.close();
    }
}
export async function updateAgent(store, agentId, input) {
    const current = await mustGetActiveAgent(store, agentId);
    if (input.clearIsDefault && current.isDefault) {
        const own = await ownDefaultAgents(store);
        if (own.length === 1 && own[0].id === current.id) {
            throw new CoreError('AGENT_LAST_DEFAULT');
        }
    }
    const enabledSkills = patch(input.enabledSkills, current.enabledSkills);
    const installedBase = patch(input.installedSkills, current.installedSkills);
    const imageBase = input.clearImageSettings ? {} : current;
    const updated = {
        ...current,
        name: patch(input.name, current.name),
        bio: patch(input.bio, current.bio),
        providerDeviceId: patch(input.providerDeviceId, current.providerDeviceId),
        modelName: patch(input.modelName, current.modelName),
        reasoning: patch(input.reasoning, current.reasoning),
        enabledSkills,
        installedSkills: mergeSkills(installedBase, enabledSkills),
        isDefault: input.clearIsDefault ? false : input.isDefault || current.isDefault,
        imageModelChoice: patch(input.imageModelChoice, imageBase.imageModelChoice),
        kvCacheK: patch(input.kvCacheK, current.kvCacheK),
        kvCacheV: patch(input.kvCacheV, current.kvCacheV),
        iconName: patch(input.iconName, current.iconName),
        ctxSize: input.clearCtxSize ? undefined : input.ctxSize || current.ctxSize || undefined,
        ...allTools(),
        skillsScope: patch(input.skillsScope, current.skillsScope),
        imageSteps: input.imageSteps || imageBase.imageSteps || undefined,
        imageWidth: input.imageWidth || imageBase.imageWidth || undefined,
        imageHeight: input.imageHeight || imageBase.imageHeight || undefined,
        approvalMode: patch(input.approvalMode, current.approvalMode),
        disabledToolsets: patch(input.disabledToolsets, current.disabledToolsets),
        updatedAt: Math.max(Date.now(), current.updatedAt + 1)
    };
    await store.dispatch('put-agent', { agent: updated });
    return updated;
}
export async function rehomeAgents(store, from, to) {
    const hasDefault = (await getDefaultAgent(store, to)) !== null;
    for (const agent of await listAgents(store, from)) {
        if (!agent.deletedAt) {
            await updateAgent(store, agent.id, {
                providerDeviceId: to,
                clearIsDefault: hasDefault && agent.isDefault
            });
        }
    }
}
export async function deleteAgent(store, deviceId, { id, keepChats, keepCopies }) {
    const current = await mustGetAgent(store, id);
    if (current.isDefault) {
        throw new CoreError('AGENT_DEFAULT_UNDELETABLE');
    }
    const deletedAt = Date.now();
    const updated = {
        ...current,
        deletedAt,
        updatedAt: Math.max(deletedAt, current.updatedAt + 1)
    };
    if (keepChats) {
        await keepCopies?.(updated);
    }
    await store.dispatch('put-agent', { agent: updated });
    if (!keepChats) {
        await softDeleteChatsForAgent(store, deviceId, id);
    }
    else if (deviceId) {
        await cancelRunsForAgent(store, deviceId, id);
    }
    await softDeleteToolConfigsForAgent(store, id);
    return updated;
}
