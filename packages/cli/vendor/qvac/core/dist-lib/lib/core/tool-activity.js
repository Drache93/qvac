import { capToolActivityArguments } from '../../schema/qvac.js';
import { randomId } from './id.js';
import { keyRange } from './range.js';
import { TOOL_ACTIVITY_BY_AGENT } from './collections.js';
export async function recordToolActivity(store, input) {
    const activity = {
        id: randomId(),
        agentId: input.agentId,
        originDeviceId: input.originDeviceId,
        chatId: input.chatId,
        runId: input.runId,
        toolName: input.toolName,
        arguments: capToolActivityArguments(input.arguments),
        resource: input.resource ?? undefined,
        effect: input.effect,
        decision: input.decision,
        at: input.at,
        seq: 0
    };
    await store.dispatch('append-tool-activity', { activity });
    return { id: activity.id };
}
export async function listToolActivity(store, agentId, bounds = {}) {
    const snap = store.view.snapshot();
    try {
        return await snap
            .find(TOOL_ACTIVITY_BY_AGENT, {
            ...keyRange({ agentId }, 'seq', bounds),
            reverse: true
        })
            .toArray();
    }
    finally {
        await snap.close();
    }
}
