import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import { AbortedError } from '@qvac/harness/race-abort';
import { getAgent, landingAgentId } from './agent.js';
import { accountPicks } from './shared-agents.js';
import { TERMINAL_RUN_STATES, cancelActiveRuns, deleteChat, getChat, mustGetActiveChat } from './chat.js';
import { copyMovedChunks, copyMovedKnowledge, movedBlob, stripped } from './chat-copy.js';
import { ownReadThrough } from './chat-read.js';
import { appendChunk, getChunk, listChunks, updateOp } from './chunk.js';
import { derivedId } from './id.js';
import { isPendingBlobReference } from './files/index.js';
import { CoreError } from '../errors.js';
import { errorMessage } from '../guards.js';
import { CHATS, CHAT_READS, DEVICES, KNOWLEDGE, KNOWLEDGE_BY_CHAT } from './collections.js';
export const CHAT_MOVED = 'chat-moved';
export const SOURCE_GONE = 'the chat was deleted before its files arrived';
export const TARGET_GONE = 'the moved chat was deleted before its files arrived';
export const NOT_CARRIED = 'a file could not be carried into the target';
export const OTHERS_RUN = "another member's move left a run in the target that only they can finish";
export class ChatMoves {
    _open;
    _local;
    _deviceId;
    _log;
    _agents;
    _listeners = new Set();
    _settling = new Map();
    _moving = new Map();
    _abort = new AbortController();
    _onChange = () => this._changed();
    _patching = Promise.resolve();
    _closing = false;
    constructor(open, local, { deviceId, log, account, agents }) {
        this._open = open;
        this._local = local;
        this._deviceId = deviceId;
        this._log = log;
        this._agents = agents ?? accountPicks(account ?? (() => null));
    }
    get closing() {
        return this._closing;
    }
    watch(listener) {
        this._listeners.add(listener);
    }
    unwatch(listener) {
        this._listeners.delete(listener);
    }
    async move(request) {
        const key = request.meshId + request.chatId;
        const moving = this._moving.get(key) ?? this._begin(request);
        this._moving.set(key, moving);
        try {
            await moving;
        }
        finally {
            if (this._moving.get(key) === moving) {
                this._moving.delete(key);
            }
        }
        return this.status(request);
    }
    async status({ meshId, chatId }) {
        const row = await this._local.readChatMove((await this._open(meshId)).key, chatId);
        if (!row) {
            throw new CoreError('CHAT_MOVE_NOT_FOUND');
        }
        const settled = row.completedAt || row.failure;
        const pair = settled
            ? null
            : {
                source: await this._open(hex(row.meshKey)),
                target: await this._open(hex(row.targetMeshKey))
            };
        const waiting = pair ? filesOf(await waitingFiles(pair, row)) : [];
        return {
            meshId,
            chatId,
            targetMeshId: hex(row.targetMeshKey),
            targetChatId: row.targetChatId,
            state: stateOf(row, waiting.length),
            files: row.carried + waiting.length,
            carried: row.carried,
            waiting: waiting.map((file) => file.fileName),
            restarted: !!row.restartRunId,
            failure: row.failure ?? undefined
        };
    }
    async resume() {
        for (const row of await this._local.listChatMoves()) {
            if (!row.completedAt && !row.failure) {
                this._start(row).copied.catch(noop);
            }
        }
    }
    async close() {
        this._closing = true;
        this._abort.abort(new AbortedError());
        this._changed();
        await Promise.allSettled([...this._settling.values()].map((settling) => settling.done));
    }
    async _begin({ meshId, chatId, targetMeshId, agentId }) {
        if (meshId === targetMeshId)
            throw new CoreError('CHAT_MOVE_SAME_MESH');
        const pair = { source: await this._open(meshId), target: await this._open(targetMeshId) };
        await this._assertMovable(pair, chatId);
        const held = await this._local.readChatMove(pair.source.key, chatId);
        if (held && !held.completedAt && !held.failure) {
            return this._start(held).copied;
        }
        const chat = await mustGetActiveChat(pair.source, chatId);
        const targetChatId = await movedChatId(pair.target, chatId);
        const [first] = await listChunks(pair.source, { chatId, limit: 1 });
        const clash = first ? await getChunk(pair.target, first.id) : null;
        if (clash && clash.chatId !== targetChatId) {
            throw new CoreError('CHAT_MOVE_ID_CONFLICT');
        }
        await this._agents.pick(pair.target, agentId);
        const row = {
            meshKey: pair.source.key,
            chatId,
            targetMeshKey: pair.target.key,
            targetChatId,
            agentId: await landingAgentId(pair.target, chat.agentId, agentId),
            carried: 0,
            startedAt: Date.now()
        };
        await this._local.recordChatMove(row);
        await this._cancel(pair, row);
        return this._start(row).copied;
    }
    async _assertMovable({ source, target }, chatId) {
        const device = await target.view.get(DEVICES, { id: this._deviceId });
        const writer = device?.writerKey && b4a.equals(device.writerKey, target.localWriterKey);
        if (!target.writable || !writer || device?.revoked) {
            throw new CoreError('CHAT_TARGET_NOT_WRITER');
        }
        if ((await pendingFiles(source, chatId)).length > 0 || (await this._arriving(source, chatId))) {
            throw new CoreError('CHAT_MOVE_STILL_ARRIVING');
        }
    }
    async _arriving(mesh, chatId) {
        const moves = await this._local.listChatMoves();
        return moves.some((move) => !move.completedAt &&
            !move.failure &&
            move.targetChatId === chatId &&
            b4a.equals(move.targetMeshKey, mesh.key));
    }
    _start(row) {
        const key = hex(row.meshKey) + row.chatId;
        const held = this._settling.get(key);
        if (held) {
            return held;
        }
        const copied = Promise.withResolvers();
        const done = this._settle(row, copied)
            .catch((err) => this._fail(row, err))
            .finally(() => this._settling.delete(key));
        const settling = { copied: copied.promise, done };
        this._settling.set(key, settling);
        return settling;
    }
    async _fail(row, err) {
        if (this._closing)
            return;
        this._log?.warn('chat-move', 'move failed', { chatId: row.chatId, err });
        await this._patch(row, { failure: errorMessage(err) });
    }
    async _settle(row, copied) {
        const pair = {
            source: await this._open(hex(row.meshKey)),
            target: await this._open(hex(row.targetMeshKey))
        };
        try {
            await this._copy(pair, row);
            copied.resolve();
        }
        catch (err) {
            copied.reject(err);
            throw err;
        }
        pair.target.watch(this._onChange);
        try {
            await this._land(pair, row);
        }
        finally {
            pair.target.unwatch(this._onChange);
        }
    }
    async _land(pair, row) {
        while (!this._closing) {
            const gone = await this._gone(pair, row);
            if (gone) {
                return this._giveUp(pair, row, gone);
            }
            const moved = await this._copy(pair, row);
            if (moved.withheld > 0) {
                await this._patch(row, { failure: OTHERS_RUN });
                return;
            }
            const carry = await this._carry(pair, row);
            if (carry.cut || this._closing) {
                continue;
            }
            if (moved.open.size > 0) {
                await this._stopped(pair, row, moved.open);
                continue;
            }
            if (moved.copied === 0 && carry.pending === 0) {
                return this._leave(pair, row);
            }
            if (carry.pending > 0) {
                await this._changeOf(pair);
            }
        }
    }
    async _leave(pair, row) {
        const gone = await this._gone(pair, row);
        if (gone) {
            return this._giveUp(pair, row, gone);
        }
        await this._restart(pair, row);
        const { agentId } = await deleteChat(pair.source, this._deviceId, row.chatId);
        await this._patch(row, { completedAt: Date.now() });
        await this._agents.unpick(pair.source, agentId).catch((err) => {
            this._log?.warn('chat-move', "letting go of the moved chat's agent failed", { err });
        });
    }
    async _cancel({ source }, row) {
        await cancelActiveRuns(source, row.chatId, { deviceId: this._deviceId, reason: CHAT_MOVED });
    }
    async _stopped(pair, row, runs) {
        const change = this._changeOf(pair);
        await this._cancel(pair, row);
        const statuses = await listChunks(pair.source, { chatId: row.chatId, type: 'run-status' });
        const ended = statuses.filter((c) => TERMINAL_RUN_STATES.has(c.runStatus?.state ?? ''));
        const stopped = new Set(ended.map((c) => c.runId));
        if ([...runs].some((runId) => !stopped.has(runId))) {
            await change;
        }
    }
    async _copy(pair, row) {
        await this._cancel(pair, row);
        const snap = pair.source.view.snapshot();
        try {
            const chat = await snap.get(CHATS, { id: row.chatId });
            if (!chat || chat.deletedAt) {
                return { copied: 0, open: new Set(), withheld: 0 };
            }
            if (!(await getChat(pair.target, row.targetChatId))) {
                await pair.target.dispatch('put-chat', { chat: movedChat(chat, row) });
            }
            await this._carryRead(pair, { row, snap, chat });
            const copy = this._copyOf(pair, row);
            const copied = await copyMovedChunks(snap, row.chatId, copy);
            await copyMovedKnowledge(snap, row.chatId, copy);
            this._changed();
            return copied;
        }
        finally {
            await snap.close();
        }
    }
    async _carryRead({ source, target }, { row, snap, chat }) {
        const memberId = target.ourMemberId;
        const readThrough = await ownReadThrough(snap, chat, source.ourMemberId);
        const chatId = row.targetChatId;
        if (!memberId || !readThrough || (await target.view.get(CHAT_READS, { chatId, memberId }))) {
            return;
        }
        await target.dispatch('mark-chat-read', { chatId, memberId, readThrough });
    }
    _copyOf({ source, target }, row) {
        return {
            from: source,
            into: target,
            chatId: row.targetChatId,
            originDeviceId: this._deviceId,
            references: new Map()
        };
    }
    async _carry(pair, row) {
        const pending = await waitingFiles(pair, row);
        const cut = this._watchGone(pair, { row, carrying: new Set(pending.map((file) => file.id)) });
        const carry = { pair, row, signal: cut.signal };
        try {
            const own = pending.filter((file) => file.chunk && this._owns(file.chunk));
            await this._each(own, (file) => this._carryChunk(carry, file));
            const rows = (await waitingFiles(pair, row)).filter((f) => !f.chunk);
            await this._each(rows, (file) => this._carryKnowledge(carry, file));
        }
        finally {
            cut.stop();
        }
        const left = filesOf(await waitingFiles(pair, row)).length;
        return { pending: left, cut: cut.signal.aborted };
    }
    async _each(files, fn) {
        const results = await Promise.allSettled(files.map(fn));
        for (const result of results) {
            if (result.status === 'rejected' && !(result.reason instanceof AbortedError)) {
                throw result.reason;
            }
        }
    }
    async _carryChunk({ pair, row, signal }, file) {
        const origin = (await getChunk(pair.source, file.id))?.attachment;
        if (!origin || !file.chunk?.attachment) {
            throw new Error(NOT_CARRIED);
        }
        if (origin.deletedAt) {
            const attachment = { ...file.chunk.attachment, deletedAt: origin.deletedAt };
            await pair.target.dispatch('update-chunk', updateOp(file.chunk, { id: file.id, attachment }));
            return;
        }
        const blobId = await this._fetch(pair, { row, origin, signal });
        const attachment = { ...file.chunk.attachment, blobId };
        await this._counted(row, { quiet: true });
        await pair.target.dispatch('update-chunk', updateOp(file.chunk, { id: file.id, attachment }));
        const landed = (await getChunk(pair.target, file.id))?.attachment;
        if (landed && !landed.deletedAt && isPendingBlobReference(landed.blobId)) {
            throw new Error(NOT_CARRIED);
        }
        await pair.target.fileIndex?.record([{ ...file.chunk, attachment }]);
    }
    async _carryKnowledge({ pair, row, signal }, file) {
        const origin = await pair.source.view.get(KNOWLEDGE, { id: file.id });
        if (!origin) {
            throw new Error(NOT_CARRIED);
        }
        const attached = await liveAttachment(pair.target, {
            chatId: row.targetChatId,
            fileId: file.id
        });
        if (attached && isPendingBlobReference(attached.blobId)) {
            return;
        }
        let blobId = attached?.blobId;
        if (!blobId) {
            blobId = await this._fetch(pair, { row, origin, signal });
            await this._counted(row);
        }
        const knowledge = { ...stripped(origin), chatId: row.targetChatId, blobId };
        await pair.target.dispatch('add-knowledge', { knowledge });
    }
    async _fetch(pair, { row, origin, signal }) {
        await pair.source.files.download(origin.blobId, { signal });
        const blobId = await movedBlob(this._copyOf(pair, row), origin);
        if (isPendingBlobReference(blobId)) {
            throw new Error(NOT_CARRIED);
        }
        return blobId;
    }
    _owns(chunk) {
        return b4a.equals(chunk.originDeviceId, this._deviceId);
    }
    async _gone({ source, target }, row) {
        if (await this._left(source))
            return SOURCE_GONE;
        if (await this._left(target))
            return TARGET_GONE;
        const chat = await getChat(source, row.chatId);
        if (!chat || chat.deletedAt) {
            return SOURCE_GONE;
        }
        const moved = await getChat(target, row.targetChatId);
        return moved?.deletedAt ? TARGET_GONE : null;
    }
    async _left(mesh) {
        return mesh.role !== 'public' && !(await this._local.readMeshSession(mesh.key));
    }
    async _giveUp(pair, row, reason) {
        if (reason === TARGET_GONE) {
            await this._patch(row, { failure: reason });
            return;
        }
        const left = await this._left(pair.source);
        const pending = left
            ? await pendingFiles(pair.target, row.targetChatId)
            : await waitingFiles(pair, row);
        if (!left && pending.length === 0) {
            await this._patch(row, { completedAt: Date.now() });
            return;
        }
        await this._dropPending(pair.target, pending);
        await this._patch(row, { failure: reason });
    }
    async _dropPending(target, pending) {
        const at = Date.now();
        for (const file of pending) {
            if (file.chunk?.attachment && this._owns(file.chunk)) {
                const attachment = { ...file.chunk.attachment, deletedAt: at };
                await target.dispatch('update-chunk', updateOp(file.chunk, { id: file.id, attachment }));
            }
        }
    }
    async _restart({ target }, row) {
        const agent = await getAgent(target, row.agentId);
        if (!agent || agent.deletedAt) {
            return;
        }
        const chatId = row.targetChatId;
        const interrupted = (await listChunks(target, { chatId, type: 'run-request' })).at(-1);
        if (interrupted?.parentId && interrupted.id === derivedId(interrupted.parentId, 'restart')) {
            await this._patch(row, { restartRunId: interrupted.id });
            return;
        }
        if (!interrupted?.runId || !(await stoppedByMove(target, interrupted))) {
            return;
        }
        const restartId = derivedId(interrupted.id, 'restart');
        await appendChunk(target, {
            id: restartId,
            chatId,
            runId: restartId,
            type: 'run-request',
            runRequest: { agentId: row.agentId },
            capability: interrupted.capability,
            capabilityArgs: interrupted.capabilityArgs,
            enhance: interrupted.enhance,
            parentId: interrupted.id,
            originDeviceId: this._deviceId
        });
        await this._patch(row, { restartRunId: restartId });
    }
    _counted(row, opts = {}) {
        return this._patch(row, (stored) => ({ carried: stored.carried + 1 }), opts);
    }
    _patch(row, patch, { quiet = false } = {}) {
        const write = this._patching.then(async () => {
            const stored = (await this._local.readChatMove(row.meshKey, row.chatId)) ?? row;
            const next = { ...stored, ...(typeof patch === 'function' ? patch(stored) : patch) };
            await this._local.recordChatMove(next);
            if (!quiet) {
                this._changed();
            }
            return next;
        });
        this._patching = write.catch(noop);
        return write;
    }
    _changed() {
        for (const listener of this._listeners) {
            listener();
        }
    }
    _changeOf({ source, target }) {
        return new Promise((resolve) => {
            const done = () => {
                source.unwatch(done);
                target.unwatch(done);
                this._local.unwatch(done);
                this._abort.signal.removeEventListener('abort', done);
                resolve();
            };
            source.watch(done);
            target.watch(done);
            this._local.watch(done);
            this._abort.signal.addEventListener('abort', done, { once: true });
        });
    }
    _watchGone(pair, { row, carrying }) {
        const controller = new AbortController();
        const abort = () => controller.abort(new AbortedError());
        const cut = async () => {
            if (await this._gone(pair, row))
                return true;
            const pending = await waitingFiles(pair, row);
            const ids = new Set(pending.map((file) => file.id));
            return [...carrying].some((id) => !ids.has(id));
        };
        const check = () => {
            void cut().then((done) => done && abort(), noop);
        };
        pair.source.watch(check);
        pair.target.watch(check);
        this._local.watch(check);
        this._abort.signal.addEventListener('abort', abort, { once: true });
        if (this._abort.signal.aborted) {
            abort();
        }
        return {
            signal: controller.signal,
            stop: () => {
                pair.source.unwatch(check);
                pair.target.unwatch(check);
                this._local.unwatch(check);
                this._abort.signal.removeEventListener('abort', abort);
            }
        };
    }
}
async function stoppedByMove(mesh, request) {
    const statuses = await listChunks(mesh, { chatId: request.chatId, type: 'run-status' });
    return statuses.some((chunk) => chunk.runId === request.runId &&
        chunk.runStatus?.state === 'canceled' &&
        chunk.runStatus.reason === CHAT_MOVED);
}
function filesOf(pending) {
    return [...new Map(pending.map((file) => [file.fileId, file])).values()];
}
async function liveAttachment(mesh, { chatId, fileId }) {
    const chunks = await listChunks(mesh, { chatId, type: 'attachment' });
    const attachment = chunks.find((chunk) => chunk.attachment?.id === fileId)?.attachment;
    return attachment && !attachment.deletedAt ? attachment : null;
}
async function pendingFiles(mesh, chatId) {
    const files = [];
    for (const chunk of await listChunks(mesh, { chatId, type: 'attachment' })) {
        const attachment = chunk.attachment;
        if (attachment && !attachment.deletedAt && isPendingBlobReference(attachment.blobId)) {
            files.push({ id: chunk.id, fileId: attachment.id, fileName: attachment.fileName, chunk });
        }
    }
    return files;
}
async function waitingFiles(pair, row) {
    const files = await pendingFiles(pair.target, row.targetChatId);
    const inChat = { gte: { chatId: row.chatId }, lte: { chatId: row.chatId } };
    const rows = await pair.source.view.find(KNOWLEDGE_BY_CHAT, inChat).toArray();
    for (const knowledge of rows) {
        if (knowledge.deletedAt)
            continue;
        if (await pair.target.view.get(KNOWLEDGE, { id: knowledge.id })) {
            continue;
        }
        files.push({
            id: knowledge.id,
            fileId: knowledge.id,
            fileName: knowledge.fileName,
            chunk: null
        });
    }
    return files;
}
function movedChat(chat, row) {
    return {
        ...stripped(chat),
        id: row.targetChatId,
        agentId: row.agentId,
        groupId: undefined,
        projectId: undefined,
        rank: undefined,
        rankedAt: undefined,
        readThrough: undefined,
        updatedAt: Date.now()
    };
}
function stateOf(row, waiting) {
    if (row.failure)
        return 'failed';
    if (row.completedAt)
        return 'complete';
    return waiting > 0 ? 'carrying' : 'leaving';
}
export async function movedChatId(target, chatId) {
    for (let attempt = 0;; attempt++) {
        const id = derivedId(chatId, hex(target.key), String(attempt));
        if (!(await getChat(target, id))?.deletedAt) {
            return id;
        }
    }
}
function hex(key) {
    return b4a.toHex(key);
}
function noop() { }
