import b4a from 'b4a';
import { raw } from 'compact-encoding';
import Protomux from 'protomux';
import { isRecord } from '../../lib/guards.js';
const PROTOCOL = 'qvac/walkie-talkie/1';
const STATUSES = {
    answered: 'answered',
    denied: 'denied',
    aborted: 'aborted',
    budget: 'budget',
    error: 'error'
};
const EVENTS = {
    message: 'message',
    thought: 'thought',
    tool: 'tool',
    permission: 'permission',
    usage: 'usage',
    end: 'end',
    error: 'error'
};
const USAGE = ['inputTokens', 'outputTokens', 'costUsd', 'turns'];
function proof(crypto, team, connection) {
    return b4a.toHex(crypto.hash([team, connection.handshakeHash]));
}
export function openLine(connection, options) {
    const { crypto, team, me, onOpen, onFrame, onClose } = options;
    let line = null;
    const channel = Protomux.from(connection).createChannel({
        protocol: PROTOCOL,
        id: crypto.discoveryKey(team),
        onclose: () => line && onClose(line)
    });
    if (!channel) {
        return;
    }
    const onmessage = ({ head, bodies }) => {
        const message = parse(head);
        if (line && message && message.type !== 'hello') {
            onFrame(line, { message, bodies });
        }
        else if (!line &&
            message?.type === 'hello' &&
            message.proof === proof(crypto, team, connection)) {
            const { name, agents, people } = message;
            line = { name, agents, people, send, close: () => channel.close() };
            onOpen(line);
        }
        else if (!line) {
            connection.destroy();
        }
    };
    const out = channel.addMessage({
        encoding: raw,
        onmessage: (packed) => onmessage(unpack(packed))
    });
    const send = (message, bodies = []) => out.send(pack({ head: message, bodies }));
    connection.on('error', noop);
    channel.open();
    send({ type: 'hello', ...me, agents: [...me.agents], proof: proof(crypto, team, connection) });
}
function pack({ head, bodies }) {
    const parts = [b4a.from(JSON.stringify(head)), ...bodies];
    return b4a.concat(parts.flatMap((part) => [length(part.byteLength), part]));
}
function unpack(packed) {
    const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
    const parts = [];
    for (let at = 0; at + 4 <= packed.byteLength;) {
        const size = view.getUint32(at);
        parts.push(packed.subarray(at + 4, at + 4 + size));
        at += 4 + size;
    }
    const [head, ...bodies] = parts;
    return { head: head ? JSON.parse(b4a.toString(head)) : null, bodies };
}
function length(size) {
    const out = b4a.alloc(4);
    new DataView(out.buffer, out.byteOffset, 4).setUint32(0, size);
    return out;
}
function parse(head) {
    if (!isRecord(head)) {
        return null;
    }
    if (head.type === 'hello') {
        const agents = Array.isArray(head.agents) ? head.agents : [];
        const infos = agents
            .filter(isRecord)
            .map(({ name, description }) => ({ name: String(name), description: String(description) }));
        const [name, given] = [text(head.name), text(head.proof)];
        const people = head.people === true;
        return name && given ? { type: 'hello', name, agents: infos, people, proof: given } : null;
    }
    const id = text(head.id);
    return id ? addressed(head, id) : null;
}
function addressed(head, id) {
    const { type } = head;
    if (type === 'cancel' || type === 'settled') {
        return { type, id };
    }
    const files = Array.isArray(head.files) ? head.files.map(String) : [];
    if (type === 'message') {
        const [to, body] = [text(head.to), text(head.text)];
        return to && body !== null ? { type, id, to, text: body, files } : null;
    }
    if (type === 'reply') {
        const status = STATUSES[String(head.status)] ?? 'error';
        return { type, id, status, text: text(head.text) ?? '', usage: usage(head.usage), files };
    }
    if (type === 'event') {
        const event = isRecord(head.event) ? head.event : {};
        const kind = EVENTS[String(event.type)];
        return kind ? { type, id, event: { ...event, type: kind } } : null;
    }
    const question = text(head.question);
    if (type === 'ask') {
        return question ? { type, id, question } : null;
    }
    return type === 'answer' ? { type, id, text: text(head.text) } : null;
}
function usage(value) {
    const given = isRecord(value) ? value : {};
    const out = {};
    for (const key of USAGE) {
        const count = given[key];
        if (typeof count === 'number') {
            out[key] = count;
        }
    }
    return out;
}
function text(value) {
    return typeof value === 'string' ? value : null;
}
function noop() { }
