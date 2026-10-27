import { devicesByWriterKey, liveDeviceForWriter, trackActivity } from './activity.js';
import { foreignChat, isPurged } from './chat.js';
import { appendRow, asModelRequest, closeRounds, hostOutputRefusal, openRound, outputRefusal, roundChunkRefusal, served } from './model-requests.js';
import { outsideProject, projectRules, signerMember } from './projects.js';
import { runHasTerminalStatus, runnerRefusal, TERMINAL_RUN_STATES } from './run-requests.js';
import { CHUNK_PAYLOAD_FIELDS, ragSourcesWithinBounds } from '../../../schema/qvac.js';
import b4a from 'b4a';
import { CHUNKS, DEVICES, RUN_REQUEST_BY_RUN } from '../collections.js';
import { isProbeRound } from '../../probe-rounds.js';
const CREDITED_CHUNK_TYPES = new Set(['run-request', 'run-status']);
export function runRequestOf(db, chatId, runId) {
    const run = { chatId, runId };
    return db.findOne(RUN_REQUEST_BY_RUN, { gte: run, lte: run });
}
async function asksFor(context, chunk) {
    const signer = await signerMember(context);
    const asker = chunk.requesterMemberId;
    return !!signer && !!asker && b4a.equals(signer, asker);
}
export async function ownRunRequest(context, chatId, runId) {
    const request = chatId ? await runRequestOf(context.tx, chatId, runId) : null;
    return request && (await asksFor(context, request)) ? request : null;
}
async function requesterFor(op, context, round) {
    if (!(await projectRules(context.tx))) {
        return undefined;
    }
    if (round) {
        return round.requesterMemberId ?? null;
    }
    if (op.type === 'run-request' && op.runId) {
        const taken = await runRequestOf(context.tx, op.chatId, op.runId);
        return taken ? null : signerMember(context);
    }
    if (!op.runId) {
        return signerMember(context);
    }
    if (op.type === 'run-status' && op.runStatus?.state === 'canceled') {
        const request = await runRequestOf(context.tx, op.chatId, op.runId);
        const member = await signerMember(context);
        return request && !(await outsideProject(context.tx, member)) ? request.requesterMemberId : null;
    }
    return (await ownRunRequest(context, op.chatId, op.runId))?.requesterMemberId ?? null;
}
async function driverRefusal(op, { tx, node }) {
    if (!op.runId || op.type === 'run-request') {
        return null;
    }
    if (op.type === 'run-status' && op.runStatus?.state === 'canceled') {
        return null;
    }
    const request = await runRequestOf(tx, op.chatId, op.runId);
    if (!request?.runnerDeviceId || request.capability) {
        return null;
    }
    const signer = await liveDeviceForWriter(tx, node.key);
    const driver = request.runTakenBy;
    return signer && driver && b4a.equals(signer.id, driver)
        ? null
        : 'a handed-off run is written by the device that took it';
}
async function isOriginWriter(tx, chunk, writerKey) {
    const device = await tx.get(DEVICES, { id: chunk.originDeviceId });
    return !!device?.writerKey && b4a.equals(device.writerKey, writerKey);
}
async function isAdmittedWriter(tx, writerKey) {
    for await (const device of devicesByWriterKey(tx, writerKey)) {
        if (!device.revoked)
            return true;
    }
    return false;
}
function payloadMatchesType(op) {
    const field = CHUNK_PAYLOAD_FIELDS[op.type];
    for (const candidate of Object.values(CHUNK_PAYLOAD_FIELDS)) {
        if ((op[candidate] !== null && op[candidate] !== undefined) !== (candidate === field)) {
            return false;
        }
    }
    return true;
}
export function registerChunkRoutes(router) {
    router.add('@qvac/append-chunk', trackActivity(async (op, context) => {
        const { tx, log } = context;
        const chunk = await tx.get(CHUNKS, { id: op.id });
        if (chunk) {
            return;
        }
        if (await isPurged(tx, op.chatId)) {
            log?.debug('contract', 'append-chunk dropped: chat is purged', { id: op.id });
            return;
        }
        if (await foreignChat(tx, op.chatId)) {
            log?.warn('contract', 'append-chunk dropped: the chat is not in this project', {
                id: op.id
            });
            return;
        }
        if (!payloadMatchesType(op)) {
            log?.warn('contract', 'append-chunk dropped: payload does not match its type', {
                id: op.id
            });
            return;
        }
        if (op.type === 'sources' && !op.runId) {
            log?.warn('contract', 'append-chunk dropped: a sources chunk requires runId', {
                id: op.id
            });
            return;
        }
        if (op.type === 'sources' && !ragSourcesWithinBounds(op.sources)) {
            log?.warn('contract', 'append-chunk dropped: a sources chunk exceeds its wire bounds', {
                id: op.id
            });
            return;
        }
        if (op.capability && op.type !== 'run-request') {
            log?.warn('contract', 'append-chunk dropped: only a run-request carries a capability', {
                id: op.id
            });
            return;
        }
        const runner = await runnerRefusal(op, context);
        if (runner) {
            log?.warn('contract', `append-chunk dropped: ${runner}`, { id: op.id });
            return;
        }
        const roundRefusal = await roundChunkRefusal(op, context);
        if (roundRefusal) {
            log?.warn('contract', `append-chunk dropped: ${roundRefusal}`, { id: op.id });
            return;
        }
        if ((op.type === 'run-status' ||
            (op.type === 'model-request' && !isProbeRound(op.modelRequest?.options))) &&
            op.runId !== null &&
            op.runId !== undefined &&
            (await runHasTerminalStatus(tx, op.chatId, op.runId))) {
            log?.warn('contract', 'append-chunk dropped: the run already has a terminal run-status', {
                id: op.id
            });
            return;
        }
        const parent = op.parentId !== null && op.parentId !== undefined
            ? await tx.get(CHUNKS, { id: op.parentId })
            : null;
        if (op.parentId && (!parent || parent.chatId !== op.chatId)) {
            log?.warn('contract', 'append-chunk dropped: parentId is not a chunk in this chat', {
                id: op.id
            });
            return;
        }
        const round = asModelRequest(parent);
        const outputRefused = (await hostOutputRefusal(op, round, context)) ??
            (round ? await outputRefusal(op, round, context) : null);
        if (outputRefused) {
            log?.warn('contract', `append-chunk dropped: ${outputRefused}`, { id: op.id });
            return;
        }
        const undriven = round ? null : await driverRefusal(op, context);
        if (undriven) {
            log?.warn('contract', `append-chunk dropped: ${undriven}`, { id: op.id });
            return;
        }
        const requesterMemberId = await requesterFor(op, context, round);
        if (requesterMemberId === null) {
            log?.warn('contract', "append-chunk dropped: a project's run is written by its owner", {
                id: op.id
            });
            return;
        }
        const appended = await appendRow(tx, { ...openRound(op), requesterMemberId });
        if (round) {
            await tx.insert(CHUNKS, served(round, op.createdAt));
        }
        if (op.type === 'run-status' &&
            TERMINAL_RUN_STATES.has(op.runStatus?.state ?? '') &&
            op.runId) {
            await closeRounds(tx, { chatId: op.chatId, runId: op.runId, at: op.createdAt });
        }
        return CREDITED_CHUNK_TYPES.has(op.type) ? appended : undefined;
    }));
    router.add('@qvac/update-chunk', trackActivity(async (op, { tx, node, log }) => {
        const chunk = await tx.get(CHUNKS, { id: op.id });
        if (!chunk) {
            log?.debug('contract', 'update-chunk dropped: unknown chunk', { id: op.id });
            return;
        }
        if (!(await isOriginWriter(tx, chunk, node.key))) {
            log?.warn('contract', 'update-chunk dropped: writer is not the origin device', {
                id: op.id
            });
            return;
        }
        if (chunk.type === 'run-status' && op.runStatus !== null && op.runStatus !== undefined) {
            if (op.runStatus.state !== chunk.runStatus?.state) {
                log?.warn('contract', 'update-chunk dropped: run-status state cannot change in place', {
                    id: op.id
                });
                return;
            }
            const next = { ...chunk, runStatus: op.runStatus, updatedAt: op.updatedAt };
            await tx.insert(CHUNKS, next);
            return next;
        }
        if (chunk.type === 'attachment' && op.attachment !== null && op.attachment !== undefined) {
            if (chunk.attachment?.deletedAt) {
                log?.debug('contract', 'update-chunk dropped: attachment is tombstoned', { id: op.id });
                return;
            }
            const next = { ...chunk, attachment: op.attachment, updatedAt: op.updatedAt };
            await tx.insert(CHUNKS, next);
            return next;
        }
        log?.warn('contract', 'update-chunk dropped: only a run-status (runStatus) or attachment (attachment) edits', { id: op.id });
    }));
    router.add('@qvac/resolve-approval', trackActivity(async (op, { tx, node, log }) => {
        const chunk = await tx.get(CHUNKS, { id: op.id });
        if (!chunk || chunk.type !== 'approval-request' || !chunk.approvalRequest) {
            log?.debug('contract', 'resolve-approval dropped: not a known approval-request', {
                id: op.id
            });
            return;
        }
        if (chunk.approvalRequest.status !== 'pending') {
            return;
        }
        if (!(await isAdmittedWriter(tx, node.key))) {
            log?.warn('contract', 'resolve-approval dropped: writer is not an admitted device', {
                id: op.id
            });
            return;
        }
        const resolved = {
            ...chunk,
            approvalRequest: {
                ...chunk.approvalRequest,
                status: op.approved ? 'approved' : 'denied'
            },
            updatedAt: op.resolvedAt
        };
        await tx.insert(CHUNKS, resolved);
        log?.info('contract', `approval ${op.approved ? 'approved' : 'denied'}`, { id: op.id });
        return resolved;
    }));
}
