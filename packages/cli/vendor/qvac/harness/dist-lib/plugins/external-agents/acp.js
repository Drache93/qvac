import { isRecord } from '../../lib/guards.js';
export const ACP_PROTOCOL_VERSION = 1;
const READ_KINDS = new Set(['read', 'search', 'think']);
const READ_ONLY_MODE = 'read-only';
export class AcpClient {
    _send;
    _pending = new Map();
    _requests = new Map();
    _notifications = new Map();
    _next = 0;
    _closed = null;
    constructor(send) {
        this._send = send;
    }
    request(method, params) {
        if (this._closed) {
            return Promise.reject(this._closed);
        }
        const id = this._next++;
        return new Promise((resolve, reject) => {
            this._pending.set(id, { resolve, reject });
            this._send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
        });
    }
    notify(method, params) {
        if (!this._closed) {
            this._send(JSON.stringify({ jsonrpc: '2.0', method, params }));
        }
    }
    handle(method, handler) {
        this._requests.set(method, handler);
    }
    on(method, handler) {
        this._notifications.set(method, handler);
    }
    receive(line) {
        const message = parse(line);
        if (!message) {
            return;
        }
        const params = isRecord(message.params) ? message.params : {};
        if (typeof message.method === 'string') {
            if ('id' in message) {
                this._answer(message.id, message.method, params);
            }
            else {
                this._notifications.get(message.method)?.(params);
            }
            return;
        }
        const id = Number(message.id);
        const pending = this._pending.get(id);
        if (!pending) {
            return;
        }
        this._pending.delete(id);
        if (isRecord(message.error)) {
            pending.reject(new Error(String(message.error.message ?? 'the agent answered an error')));
        }
        else {
            pending.resolve(message.result);
        }
    }
    close(error) {
        this._closed ??= error;
        for (const pending of this._pending.values()) {
            pending.reject(error);
        }
        this._pending.clear();
    }
    _answer(id, method, params) {
        const handler = this._requests.get(method);
        if (!handler) {
            this._reply(id, { error: { code: -32601, message: `${method} is not supported` } });
            return;
        }
        void Promise.resolve(handler(params)).then((result) => this._reply(id, { result }), (error) => this._reply(id, { error: { code: -32603, message: String(error) } }));
    }
    _reply(id, body) {
        if (!this._closed) {
            this._send(JSON.stringify({ jsonrpc: '2.0', id, ...body }));
        }
    }
}
function parse(line) {
    try {
        const message = JSON.parse(line);
        return isRecord(message) ? message : null;
    }
    catch {
        return null;
    }
}
export async function acpTurn(client, task, options) {
    const { signal } = options;
    const turn = {
        task,
        transcript: [],
        kinds: new Map(),
        text: '',
        costUsd: undefined,
        stop: null,
        cancel: () => client.close(new Error('aborted'))
    };
    client.handle('session/request_permission', (params) => permission(turn, params, signal));
    client.on('session/update', (params) => update(turn, params, options));
    const onAbort = () => turn.cancel();
    if (signal.aborted) {
        onAbort();
    }
    else {
        signal.addEventListener('abort', onAbort, { once: true });
    }
    try {
        const stopReason = await prompt(client, turn, options);
        turn.transcript.push({ type: 'end', stopReason });
        return result(turn, stopReason, signal);
    }
    catch (error) {
        turn.transcript.push({ type: 'error', message: String(Reflect.get(Object(error), 'message')) });
        return {
            status: signal.aborted ? 'aborted' : 'error',
            text: turn.text || String(Reflect.get(Object(error), 'message')),
            transcript: turn.transcript
        };
    }
    finally {
        signal.removeEventListener('abort', onAbort);
    }
}
async function prompt(client, turn, { graceMs, signal }) {
    await client.request('initialize', {
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
    });
    const session = Object(await client.request('session/new', { cwd: turn.task.workdir, mcpServers: [] }));
    const sessionId = String(session.sessionId);
    const modes = Array.isArray(Object(session.modes).availableModes)
        ? Object(session.modes).availableModes
        : [];
    if (turn.task.access === 'read' && modes.some((mode) => Object(mode).id === READ_ONLY_MODE)) {
        await client.request('session/set_mode', { sessionId, modeId: READ_ONLY_MODE });
    }
    const asked = client.request('session/prompt', {
        sessionId,
        prompt: [{ type: 'text', text: turn.task.prompt }]
    });
    let gaveUp = () => { };
    let grace;
    const givenUp = new Promise((resolve) => {
        gaveUp = () => resolve('cancelled');
    });
    turn.cancel = () => {
        client.notify('session/cancel', { sessionId });
        grace ??= setTimeout(gaveUp, graceMs);
    };
    if (signal.aborted) {
        turn.cancel();
    }
    try {
        const answered = await Promise.race([asked, givenUp]);
        return typeof answered === 'string' ? answered : String(Object(answered).stopReason);
    }
    finally {
        clearTimeout(grace);
    }
}
function result(turn, stopReason, signal) {
    const usage = turn.costUsd === undefined ? undefined : { costUsd: turn.costUsd };
    const status = () => {
        if (turn.stop === 'budget' ||
            stopReason === 'max_tokens' ||
            stopReason === 'max_turn_requests') {
            return 'budget';
        }
        if (turn.stop === 'denied') {
            return 'denied';
        }
        if (signal.aborted || stopReason === 'cancelled') {
            return 'aborted';
        }
        return stopReason === 'refusal' ? 'denied' : 'answered';
    };
    return { status: status(), text: turn.text, usage, transcript: turn.transcript };
}
function permission(turn, params, signal) {
    const call = Object(params.toolCall);
    const id = String(call.toolCallId ?? '');
    const kind = stricter(call.kind, turn.kinds.get(id));
    const options = Array.isArray(params.options) ? params.options : [];
    const allow = allowed(turn.task.access, kind);
    const option = options.find((each) => Object(each).kind === (allow ? 'allow_once' : 'reject_once'));
    const answer = signal.aborted || turn.stop || !option ? 'cancelled' : String(Object(option).optionId);
    turn.transcript.push({ type: 'permission', id, title: call.title, kind, answer });
    return answer === 'cancelled'
        ? { outcome: { outcome: 'cancelled' } }
        : { outcome: { outcome: 'selected', optionId: answer } };
}
function stricter(...kinds) {
    const declared = kinds.filter((kind) => typeof kind === 'string').map(String);
    return declared.find((kind) => !READ_KINDS.has(kind)) ?? declared[0] ?? 'other';
}
function allowed(access, kind) {
    return access === 'write' || READ_KINDS.has(kind);
}
function halt(turn, why) {
    if (!turn.stop) {
        turn.stop = why;
        turn.cancel();
    }
}
function update(turn, params, options) {
    const body = Object(params.update);
    const kind = String(body.sessionUpdate);
    if (kind === 'agent_message_chunk' || kind === 'agent_thought_chunk') {
        const text = String(Object(body.content).text ?? '');
        const type = kind === 'agent_message_chunk' ? 'message' : 'thought';
        if (type === 'message') {
            turn.text += text;
        }
        const last = turn.transcript.at(-1);
        if (last?.type === type) {
            last.text = `${String(last.text)}${text}`;
        }
        else {
            turn.transcript.push({ type, text });
        }
    }
    else if (kind === 'tool_call' || kind === 'tool_call_update') {
        tool(turn, body);
    }
    else if (kind === 'usage_update') {
        usage(turn, body, options);
    }
}
function tool(turn, body) {
    const id = String(body.toolCallId ?? '');
    if (typeof body.kind === 'string') {
        turn.kinds.set(id, body.kind);
    }
    const locations = Array.isArray(body.locations) ? body.locations : [];
    const kind = turn.kinds.get(id);
    turn.transcript.push({
        type: 'tool',
        id,
        title: body.title,
        kind,
        status: body.status,
        paths: locations.map((location) => Object(location).path)
    });
    if (turn.stop !== 'denied' && !allowed(turn.task.access, kind ?? 'other')) {
        turn.transcript.push({ type: 'permission', id, title: body.title, kind, answer: 'denied' });
        halt(turn, 'denied');
    }
}
function usage(turn, body, { maxCostUsd }) {
    const cost = Object(body.cost);
    const costUsd = typeof cost.amount === 'number' ? cost.amount : undefined;
    turn.costUsd = costUsd ?? turn.costUsd;
    turn.transcript.push({ type: 'usage', used: body.used, size: body.size, costUsd });
    if (maxCostUsd !== undefined && costUsd !== undefined && costUsd >= maxCostUsd) {
        halt(turn, 'budget');
    }
}
