import b4a from 'b4a';
import { liveDeviceForWriter, trackActivity } from './activity.js';
import { ownerSigner } from './model-requests.js';
import { chunkTypeOrdinal } from '../../../schema/indexes.js';
import { CHUNKS, CHUNKS_BY_TYPE, DEVICES } from '../collections.js';
export const TERMINAL_RUN_STATES = new Set(['completed', 'failed', 'canceled']);
export async function runHasTerminalStatus(tx, chatId, runId) {
    const type = chunkTypeOrdinal('run-status');
    const statuses = tx.find(CHUNKS_BY_TYPE, {
        gte: { chatId, type },
        lte: { chatId, type }
    });
    for await (const chunk of statuses) {
        if (chunk.runId === runId && TERMINAL_RUN_STATES.has(chunk.runStatus?.state ?? '')) {
            return true;
        }
    }
    return false;
}
export async function runnerRefusal(op, { tx, node }) {
    if (!op.runnerDeviceId) {
        return null;
    }
    if (op.type !== 'run-request' || op.capability) {
        return 'only a run-request for an agent names a runner';
    }
    const signer = await liveDeviceForWriter(tx, node.key);
    const runner = await tx.get(DEVICES, { id: op.runnerDeviceId });
    const ours = !!signer?.memberId &&
        !!runner?.memberId &&
        !runner.revoked &&
        b4a.equals(signer.memberId, runner.memberId);
    return ours ? null : "a run's runner is a device of the asker's own";
}
export async function runTaker(tx, request, writerKey) {
    const signer = await ownerSigner(tx, request, writerKey);
    if (!signer || !request.runnerDeviceId) {
        return null;
    }
    const named = b4a.equals(signer.id, request.runnerDeviceId);
    return named || b4a.equals(signer.id, request.originDeviceId) ? signer.id : null;
}
export function openToTake(request) {
    return request?.type === 'run-request' && !!request.runnerDeviceId && !request.runTakenBy;
}
export function registerRunRequestRoutes(router) {
    router.add('@qvac/take-run-request', trackActivity(async (op, { tx, node, log }) => {
        const request = await tx.get(CHUNKS, { id: op.id });
        if (!openToTake(request) || !request.runId) {
            log?.debug('contract', 'take-run-request dropped: no run-request open to take', {
                id: op.id
            });
            return;
        }
        if (await runHasTerminalStatus(tx, request.chatId, request.runId)) {
            log?.debug('contract', 'take-run-request dropped: the run has ended', { id: op.id });
            return;
        }
        const runTakenBy = await runTaker(tx, request, node.key);
        if (!runTakenBy) {
            log?.warn('contract', 'take-run-request dropped: neither its runner nor its asker', {
                id: op.id
            });
            return;
        }
        const taken = {
            ...request,
            runTakenBy,
            runTakenAt: op.at,
            updatedAt: Math.max(request.updatedAt ?? 0, op.at)
        };
        await tx.insert(CHUNKS, taken);
        return taken;
    }));
}
