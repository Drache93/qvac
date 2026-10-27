import ScopeLock from 'scope-lock';
import { findChunksOfType } from './chunk.js';
import { ACTIVE_CHATS, CHUNKS } from './collections.js';
const TERMINAL_RUN_STATES = new Set(['completed', 'failed', 'canceled']);
const ACTIVITY_CHUNK_TYPES = [
    'run-request',
    'run-status',
    'approval-request',
    'tool-call',
    'tool-result'
];
const IMAGE_TOOLS = new Set(['generate_image', 'edit_image']);
const AUDIO_TOOLS = new Set(['generate_music']);
const MEDIA_TOOLS = new Set([...IMAGE_TOOLS, ...AUDIO_TOOLS]);
const catalogs = new WeakMap();
export function listChatActivity(store, chatIds) {
    let catalog = catalogs.get(store);
    if (!catalog) {
        catalog = new ChatActivityCatalog(store.log);
        catalogs.set(store, catalog);
    }
    return catalog.list(store, chatIds);
}
class ChatActivityCatalog {
    _log;
    _lock;
    _chats;
    _head;
    _forwards;
    constructor(log) {
        this._log = log;
        this._lock = new ScopeLock();
        this._chats = new Map();
        this._head = null;
        this._forwards = 0;
    }
    async list(store, chatIds) {
        await this._lock.lock();
        try {
            const head = store.view.db.head();
            const forwards = store.autobee.stats.fastForwards;
            if (forwards !== this._forwards) {
                this._head = null;
            }
            this._forwards = forwards;
            const snap = store.view.snapshot();
            try {
                const chats = await snap.find(ACTIVE_CHATS).toArray();
                const activeChatIds = new Set(chats.map((chat) => chat.id));
                await this._refresh(snap, head, activeChatIds);
                const window = chatIds && chatIds.length > 0 ? new Set(chatIds) : null;
                return [...this._states()]
                    .filter(([id]) => !window || window.has(id))
                    .map(([id, activityState]) => ({ id, activityState }))
                    .sort((left, right) => compareIds(left.id, right.id));
            }
            finally {
                await snap.close();
            }
        }
        finally {
            this._lock.unlock();
        }
    }
    async _refresh(snap, head, activeChatIds) {
        if (!this._head || !head) {
            await this._rebuild(snap, activeChatIds);
        }
        else {
            this._prune(activeChatIds);
            await this._loadMissing(snap, activeChatIds);
            if (!(await this._applyChanges(snap, this._head, activeChatIds))) {
                await this._rebuild(snap, activeChatIds);
            }
        }
        this._head = head;
    }
    async _rebuild(snap, activeChatIds) {
        this._chats.clear();
        for (const chatId of activeChatIds) {
            await this._loadChat(snap, chatId);
        }
    }
    _prune(activeChatIds) {
        for (const chatId of this._chats.keys()) {
            if (!activeChatIds.has(chatId)) {
                this._chats.delete(chatId);
            }
        }
    }
    async _loadMissing(snap, activeChatIds) {
        for (const chatId of activeChatIds) {
            if (!this._chats.has(chatId)) {
                await this._loadChat(snap, chatId);
            }
        }
    }
    async _loadChat(snap, chatId) {
        const activity = { runs: new Map() };
        this._chats.set(chatId, activity);
        for (const chunk of await activityChunks(snap, chatId)) {
            applyChunk(activity, chunk);
        }
    }
    async _applyChanges(snap, from, activeChatIds) {
        const chunksByChat = new Map();
        try {
            for await (const change of snap.changes({ from })) {
                if (change.collection !== CHUNKS)
                    continue;
                if (change.type === 'delete')
                    return false;
                if (!activeChatIds.has(change.value.chatId)) {
                    continue;
                }
                const chunks = chunksByChat.get(change.value.chatId) ?? [];
                chunks.push(change.value);
                chunksByChat.set(change.value.chatId, chunks);
            }
        }
        catch (err) {
            this._log?.warn('chat-activity', 'diff from the cached head failed, rebuilding', err);
            return false;
        }
        for (const [chatId, chunks] of chunksByChat) {
            const activity = this._chats.get(chatId);
            if (!activity) {
                continue;
            }
            chunks.sort((left, right) => left.seq - right.seq);
            for (const chunk of chunks) {
                applyChunk(activity, chunk);
            }
        }
        return true;
    }
    _states() {
        const states = new Map();
        for (const [chatId, { runs }] of this._chats) {
            const active = [...runs.values()];
            if (active.length === 0) {
                continue;
            }
            states.set(chatId, activityState(active));
        }
        return states;
    }
}
function activityState(runs) {
    if (runs.some((run) => run.pendingApprovals.size > 0)) {
        return 'awaiting-approval';
    }
    const started = runs.filter((run) => run.started);
    if (started.length === 0) {
        return 'queued';
    }
    const latest = latestRun(started);
    if (latest.held) {
        return latest.held;
    }
    if (latest.progress === 'awaiting-download') {
        return 'awaiting-download';
    }
    return mediaState(latest) ?? 'running';
}
function mediaState(run) {
    if (run.progress === 'generating') {
        const tool = latestTool(run.tools);
        return tool && AUDIO_TOOLS.has(tool.name) ? 'generating-audio' : 'generating-image';
    }
    if (run.progress === 'transcribing') {
        return 'transcribing-audio';
    }
    return null;
}
function applyChunk(activity, chunk) {
    const runId = chunk.runId;
    if (!runId) {
        return;
    }
    if (chunk.type === 'run-request') {
        const existing = activity.runs.get(runId);
        if (existing) {
            existing.seen.add(chunk.id);
            return;
        }
        activity.runs.set(runId, createRun(chunk));
        return;
    }
    const run = activity.runs.get(runId);
    if (!run) {
        return;
    }
    run.started = true;
    if (run.seen.has(chunk.id)) {
        applyMutableChunk(run, chunk);
        return;
    }
    run.seen.add(chunk.id);
    if (chunk.type === 'run-status') {
        const status = chunk.runStatus;
        const state = status?.state ?? '';
        if (TERMINAL_RUN_STATES.has(state)) {
            activity.runs.delete(runId);
        }
        else if (state === 'executing' && chunk.seq > run.attemptSeq) {
            run.attemptSeq = chunk.seq;
            run.held = null;
            run.progress = status?.progress?.phase ?? null;
            run.tools.length = 0;
        }
        else if (state === 'paused' || state === 'recovery-required') {
            run.held = state;
            run.progress = null;
            run.tools.length = 0;
        }
        return;
    }
    if (chunk.type === 'approval-request') {
        applyApproval(run, chunk);
        return;
    }
    if (chunk.seq <= run.attemptSeq) {
        return;
    }
    if (chunk.type === 'tool-call') {
        const name = chunk.toolCall?.name;
        if (name && MEDIA_TOOLS.has(name)) {
            run.tools.push({ name, seq: chunk.seq });
        }
    }
    else if (chunk.type === 'tool-result') {
        settleTool(run.tools, chunk.toolResult?.name ?? '');
    }
}
function createRun(request) {
    return {
        requestSeq: request.seq,
        attemptSeq: request.seq,
        started: false,
        held: null,
        progress: null,
        tools: [],
        pendingApprovals: new Set(),
        seen: new Set([request.id])
    };
}
function applyMutableChunk(run, chunk) {
    if (chunk.type === 'run-status' &&
        chunk.runStatus?.state === 'executing' &&
        chunk.seq === run.attemptSeq) {
        run.progress = chunk.runStatus.progress?.phase ?? null;
    }
    else if (chunk.type === 'approval-request') {
        applyApproval(run, chunk);
    }
}
function applyApproval(run, chunk) {
    if (chunk.approvalRequest?.status === 'pending') {
        run.pendingApprovals.add(chunk.id);
    }
    else {
        run.pendingApprovals.delete(chunk.id);
    }
}
async function activityChunks(snap, chatId) {
    const groups = await Promise.all(ACTIVITY_CHUNK_TYPES.map((type) => findChunksOfType(snap, { chatId, type })));
    return groups.flat().sort((left, right) => left.seq - right.seq);
}
function settleTool(tools, name) {
    for (let index = tools.length - 1; index >= 0; index -= 1) {
        if (tools[index]?.name !== name)
            continue;
        tools.splice(index, 1);
        return;
    }
}
function latestTool(tools) {
    return tools.reduce((latest, candidate) => (!latest || candidate.seq > latest.seq ? candidate : latest), null);
}
function latestRun(runs) {
    return runs.reduce((latest, run) => (run.requestSeq > latest.requestSeq ? run : latest));
}
function compareIds(left, right) {
    if (left < right)
        return -1;
    return left > right ? 1 : 0;
}
