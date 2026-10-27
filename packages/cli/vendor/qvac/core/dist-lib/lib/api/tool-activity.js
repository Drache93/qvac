import { listToolActivity, recordToolActivity } from '../core/tool-activity.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { bounds } from './range.js';
import { CoreError } from '../errors.js';
import b4a from 'b4a';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const DECISIONS = new Set(['auto', 'allowed', 'denied', 'skip-all', 'blocked']);
function normalizeDecision(decision) {
    return isDecision(decision) ? decision : 'blocked';
}
function isDecision(decision) {
    return DECISIONS.has(decision);
}
function toEntry(row) {
    return {
        id: row.id,
        agentId: row.agentId,
        deviceId: b4a.toHex(row.originDeviceId),
        chatId: row.chatId ?? undefined,
        runId: row.runId ?? undefined,
        toolName: row.toolName,
        arguments: row.arguments ?? undefined,
        resource: row.resource ?? undefined,
        effect: row.effect ?? undefined,
        decision: row.decision,
        at: row.at,
        seq: row.seq ?? 0
    };
}
export function createToolActivityApi(pool, deviceId, log) {
    const query = async ({ agentId, ...input }, mesh) => ({
        activities: (await listToolActivity(mesh, agentId, {
            ...bounds(input),
            limit: Math.min(input.limit || DEFAULT_LIMIT, MAX_LIMIT)
        })).map(toEntry)
    });
    return {
        listToolActivity: async (request) => query(request, await requireMesh(pool, request.meshId)),
        toolActivityWatch: meshWatchable(pool, query, { name: 'toolActivityWatch', log }),
        recordToolActivity: async (request) => {
            if (!deviceId) {
                throw new CoreError('DEVICE_ID_UNAVAILABLE');
            }
            return recordToolActivity(await requireMesh(pool, request.meshId), {
                agentId: request.agentId,
                originDeviceId: deviceId,
                toolName: request.toolName,
                decision: normalizeDecision(request.decision),
                effect: request.effect ?? undefined,
                arguments: request.arguments ?? undefined,
                resource: request.resource ?? undefined,
                chatId: request.chatId ?? undefined,
                runId: request.runId ?? undefined,
                at: request.at
            });
        }
    };
}
