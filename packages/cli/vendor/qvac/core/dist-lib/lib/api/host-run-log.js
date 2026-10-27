import { listChunks, listRunRequests } from '../core/chunk.js';
import { isRunLogStep } from '../core/local/run-logs.js';
import { CoreError } from '../errors.js';
import { heldMesh, requireMesh } from './current-mesh.js';
const SETTLED_STATES = new Set(['completed', 'failed', 'canceled']);
export function createHostRunLogApi(pool, runLogs, deviceId) {
    return {
        hostRunLogBegin: async ({ meshId, runId }) => {
            const mesh = await requireMesh(pool, meshId);
            const request = await assignedRun(mesh, deviceId, runId);
            if (!request) {
                throw new CoreError('RUN_LOG_NOT_ASSIGNED', [runId]);
            }
            if (await isSettled(mesh, request)) {
                throw new CoreError('RUN_LOG_SETTLED', [runId]);
            }
            return runLogs.begin({ meshKey: mesh.key, runId });
        },
        hostRunLogAppend: async ({ meshId, runId, generation, step }) => {
            if (!isRunLogStep(step)) {
                throw new CoreError('RUN_LOG_STEP_INVALID', [runId]);
            }
            const mesh = await requireMesh(pool, meshId);
            await runLogs.append({ meshKey: mesh.key, runId, generation, step });
            return { ok: true };
        },
        hostRunLogRelease: async ({ meshId, runId, generation }) => {
            const mesh = await heldMesh(pool, meshId);
            if (!mesh) {
                return { ok: true };
            }
            const request = await assignedRun(mesh, deviceId, runId);
            if (request && (await isSettled(mesh, request))) {
                await runLogs.drop({ meshKey: mesh.key, runId });
            }
            else {
                await runLogs.release({ meshKey: mesh.key, runId, generation });
            }
            return { ok: true };
        }
    };
}
async function assignedRun(mesh, deviceId, runId) {
    return (await listRunRequests(mesh, deviceId)).find((row) => row.runId === runId);
}
async function isSettled(mesh, { chatId, runId }) {
    const statuses = await listChunks(mesh, { chatId, type: 'run-status' });
    return statuses.some((chunk) => chunk.runId === runId && SETTLED_STATES.has(chunk.runStatus?.state ?? ''));
}
