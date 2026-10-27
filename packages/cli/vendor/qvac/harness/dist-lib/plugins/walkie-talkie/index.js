import b4a from 'b4a';
import { randomBytes } from 'crypto';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { crew } from './crew.js';
import { openLine } from './wire.js';
PluginRegistry.requirePeers('walkie-talkie', {
    'hypercore-crypto': () => import.meta.resolve('hypercore-crypto'),
    hyperswarm: () => import.meta.resolve('hyperswarm')
});
const NAME = /^[\w.-]+$/;
const GRACE_MS = 5_000;
const NOBODY = { by: null, text: null };
export class WalkieTalkie {
    name = 'walkie-talkie';
    api = PluginRegistry.API_VERSION;
    read = ['ask_team'];
    _options;
    _serve;
    _self;
    _lines = new Map();
    _open = new Map();
    _closed = new WeakSet();
    _calls = new Map();
    _asked = new Map();
    _working = new Map();
    _waiters = [];
    _dropped = new Map();
    _stopped = false;
    constructor(options) {
        this._options = options;
        this._serve = new Map((options.serve ?? []).map((agent) => [agent.name, agent]));
        this._self = {
            name: options.name,
            agents: this._infos(),
            people: Boolean(options.answer),
            send: (message, bodies = []) => queueMicrotask(() => this._onFrame(this._self, { message, bodies })),
            close: noop
        };
    }
    validate() {
        const { team, name, serve = [], swarm, bootstrap } = this._options ?? {};
        if (typeof team !== 'string' || !/^[0-9a-f]{64}$/i.test(team)) {
            return 'team must be 32 bytes as hex';
        }
        if (swarm && bootstrap) {
            return 'pass a swarm or a bootstrap, not both: a swarm already has its DHT';
        }
        return [name, ...serve.map((agent) => agent.name)].every((it) => NAME.test(String(it)))
            ? null
            : 'the name and each agent name must be letters, digits, dot, dash or underscore';
    }
    async setup() {
        const [{ default: crypto }, { default: Swarm }] = await Promise.all([
            import('hypercore-crypto'),
            import('hyperswarm')
        ]);
        const team = b4a.from(this._options.team, 'hex');
        const topic = crypto.discoveryKey(team);
        const lent = this._options.swarm;
        const swarm = lent ?? new Swarm({ bootstrap: this._options.bootstrap });
        const me = { name: this._options.name, agents: this._infos(), people: this._self.people };
        const onConnection = (connection) => isConnection(connection) &&
            openLine(connection, {
                crypto,
                team,
                me,
                onOpen: (line) => this._onOpen(line),
                onFrame: (line, frame) => this._onFrame(line, frame),
                onClose: (line) => this._onClose(line)
            });
        swarm.on('connection', onConnection);
        swarm.connections.forEach(onConnection);
        const joined = swarm.join(topic, { server: true, client: true });
        void joined
            .flushed()
            .then(() => joined.refresh())
            .catch(noop);
        const teardown = async () => {
            this._stopped = true;
            swarm.off('connection', onConnection);
            this._dropped.forEach((timer) => clearTimeout(timer));
            this._open.forEach((lines) => lines.forEach((line) => line.close()));
            this._open.clear();
            this._lines.clear();
            return lent ? swarm.leave(topic) : swarm.destroy();
        };
        return { tools: [this._askTool()], teardown };
    }
    agents() {
        return [this._self, ...this._lines.values()].flatMap((line) => line.agents.map((agent) => ({
            name: `${agent.name}@${line.name}`,
            description: `${agent.description}, on ${line.name}'s machine`
        })));
    }
    crew(options) {
        const roster = {
            agents: () => this.agents(),
            send: (to, outgoing, signal) => this.send(to, outgoing, { signal })
        };
        return crew(roster, options);
    }
    teammates() {
        return [...this._lines.keys()];
    }
    async teammate(name) {
        while (!this._lines.has(name)) {
            await new Promise((resolve) => this._waiters.push(resolve));
        }
    }
    send(to, { text, attachments = {} }, sending = {}) {
        const [agent, machine = ''] = to.split('@');
        const line = this._route(machine);
        if (!line) {
            return Promise.resolve({ status: 'error', text: `${machine || to} is not on the team` });
        }
        const id = randomId();
        const files = Object.keys(attachments);
        const frame = {
            message: { type: 'message', id, to: agent, text, files },
            bodies: files.map((file) => attachments[file])
        };
        this._emit({ type: 'sent', id, from: this._options.name, to, text, attachments: files });
        return new Promise((resolve) => {
            const { signal, onEvent } = sending;
            const cancel = () => this._route(machine)?.send({ type: 'cancel', id });
            signal?.addEventListener('abort', cancel, { once: true });
            const settle = (reply) => {
                signal?.removeEventListener('abort', cancel);
                resolve(reply);
            };
            this._calls.set(id, { line, frame, to, onEvent, settle });
            line.send(frame.message, frame.bodies);
        });
    }
    ask(question, signal) {
        const id = randomId();
        const lines = [this._self, ...this._lines.values()].filter((line) => line.people);
        this._emit({ type: 'ask', id, from: this._options.name, question });
        return new Promise((resolve) => {
            const settle = (answer) => {
                if (this._asked.delete(id)) {
                    lines.forEach((line) => this._route(line.name)?.send({ type: 'settled', id }));
                    this._emit({ type: 'answer', id, ...answer });
                    resolve(answer);
                }
            };
            const waiting = new Map(lines.map((line) => [line.name, line]));
            this._asked.set(id, { question, waiting, settle });
            if (lines.length === 0 || signal?.aborted) {
                settle(NOBODY);
                return;
            }
            signal?.addEventListener('abort', () => settle(NOBODY), { once: true });
            lines.forEach((line) => line.send({ type: 'ask', id, question }));
        });
    }
    _infos() {
        return [...this._serve.values()].map(({ name, description }) => ({ name, description }));
    }
    _emit(event) {
        this._options.onEvent?.(event);
    }
    _route(name) {
        return name === this._options.name ? this._self : this._lines.get(name);
    }
    _onOpen(line) {
        clearTimeout(this._dropped.get(line.name));
        this._dropped.delete(line.name);
        this._open.set(line.name, [...(this._open.get(line.name) ?? []), line]);
        this._lines.set(line.name, line);
        this._resend(line);
        this._emit({ type: 'peer', name: line.name, agents: [...line.agents], joined: true });
        this._waiters.splice(0).forEach((wake) => wake());
    }
    _onClose(line) {
        this._closed.add(line);
        if (this._stopped) {
            return;
        }
        const open = (this._open.get(line.name) ?? []).filter((it) => it !== line);
        this._open.set(line.name, open);
        const next = open.at(-1);
        if (next) {
            this._lines.set(line.name, next);
            this._resend(next);
        }
        else if (this._lines.delete(line.name)) {
            this._dropped.set(line.name, setTimeout(() => this._left(line), GRACE_MS));
        }
    }
    _resend(line) {
        for (const call of this._calls.values()) {
            if (call.line.name === line.name && this._closed.has(call.line)) {
                call.line = line;
                line.send(call.frame.message, call.frame.bodies);
            }
        }
        for (const [id, asked] of this._asked) {
            const before = asked.waiting.get(line.name);
            if (before && this._closed.has(before)) {
                asked.waiting.set(line.name, line);
                line.send({ type: 'ask', id, question: asked.question });
            }
        }
    }
    _left(line) {
        this._dropped.delete(line.name);
        this._emit({ type: 'peer', name: line.name, agents: [...line.agents], joined: false });
        for (const [id, call] of this._calls) {
            if (call.line.name === line.name) {
                this._calls.delete(id);
                call.settle({ status: 'error', text: `${line.name} left the team` });
            }
        }
        this._asked.forEach((asked) => asked.waiting.has(line.name) && this._passed(asked, line.name));
        for (const [key, controller] of this._working) {
            if (key.startsWith(`${line.name}:`)) {
                controller.abort();
            }
        }
    }
    _onFrame(line, { message, bodies }) {
        const key = `${line.name}:${message.type === 'hello' ? '' : message.id}`;
        const again = this._working.has(key);
        if (message.type === 'message' && !again) {
            const attachments = Object.fromEntries(message.files.map((file, at) => [file, bodies[at]]));
            const incoming = { from: line.name, to: message.to, text: message.text, attachments };
            void this._respond(line, message.id, incoming);
        }
        else if (message.type === 'ask' && !again) {
            void this._answer(line, message.id, message.question);
        }
        else if (message.type === 'cancel' || message.type === 'settled') {
            this._working.get(key)?.abort();
        }
        else if (message.type === 'event') {
            this._calls.get(message.id)?.onEvent?.(message.event);
            this._emit({ type: 'event', id: message.id, event: message.event });
        }
        else if (message.type === 'reply') {
            this._replied(message, bodies);
        }
        else if (message.type === 'answer') {
            this._heard(line.name, message.id, message.text);
        }
    }
    _replied(message, bodies) {
        const call = this._calls.get(message.id);
        if (!call) {
            return;
        }
        this._calls.delete(message.id);
        const { id, status, text, usage, files } = message;
        const attachments = Object.fromEntries(files.map((file, at) => [file, bodies[at]]));
        const reply = { status, text, attachments, usage };
        this._emit({ type: 'reply', id, to: call.to, reply, attachments: files });
        call.settle(reply);
    }
    async _respond(line, id, incoming) {
        const key = `${line.name}:${id}`;
        const controller = this._work(key);
        const back = (message, bodies) => this._route(line.name)?.send(message, bodies);
        const onEvent = (event) => back({ type: 'event', id, event });
        const reply = await this._reply(incoming, { signal: controller.signal, onEvent }).catch((error) => ({ status: 'error', text: errorText(error) }));
        this._working.delete(key);
        const attachments = reply.attachments ?? {};
        const files = Object.keys(attachments);
        const { status, text, usage = {} } = reply;
        back({ type: 'reply', id, status, text, usage, files }, files.map((file) => attachments[file]));
    }
    async _reply(incoming, responding) {
        const agent = this._serve.get(incoming.to);
        if (!agent) {
            return { status: 'error', text: `${this._options.name} has no agent ${incoming.to}` };
        }
        if (!(await this._accepted(incoming))) {
            return { status: 'denied', text: `${this._options.name} declined the message` };
        }
        return agent.respond(incoming, responding);
    }
    async _accepted(incoming) {
        return this._options.accept ? this._options.accept(incoming).catch(() => false) : false;
    }
    _work(key) {
        const controller = new AbortController();
        this._working.set(key, controller);
        return controller;
    }
    _heard(name, id, text) {
        const asked = this._asked.get(id);
        if (asked && text?.trim()) {
            asked.settle({ by: name, text });
        }
        else if (asked) {
            this._passed(asked, name);
        }
    }
    _passed(asked, name) {
        asked.waiting.delete(name);
        if (asked.waiting.size === 0) {
            asked.settle(NOBODY);
        }
    }
    async _answer(line, id, question) {
        const key = `${line.name}:${id}`;
        const controller = this._work(key);
        const asking = this._options.answer?.({ from: line.name, question, signal: controller.signal });
        const text = (await asking?.catch(() => null)) ?? null;
        this._working.delete(key);
        if (!controller.signal.aborted) {
            this._route(line.name)?.send({ type: 'answer', id, text });
        }
    }
    _askTool() {
        return {
            name: 'ask_team',
            toolset: 'team',
            description: 'Ask the people on the team a question: something the request leaves open, or a ' +
                'decision only a person should make. The first answer from anyone is the answer.',
            parameters: {
                type: 'object',
                properties: {
                    question: { type: 'string', description: 'One clear question, with the options if any' }
                },
                required: ['question']
            },
            externalWrite: true,
            effect: () => 'read',
            validate: (args) => typeof args.question === 'string' && args.question.trim() ? null : 'question is required',
            execute: async (args, ctx) => {
                const { by, text } = await this.ask(String(args.question), ctx?.signal);
                return text === null
                    ? { answer: null, note: 'Nobody on the team answered. Decide, and say what you assumed.' }
                    : { answer: text, from: by };
            }
        };
    }
}
function isConnection(value) {
    return b4a.isBuffer(Reflect.get(Object(value), 'handshakeHash'));
}
function errorText(error) {
    return String(Reflect.get(Object(error), 'message') ?? error);
}
function randomId() {
    return b4a.toHex(randomBytes(8));
}
function noop() { }
