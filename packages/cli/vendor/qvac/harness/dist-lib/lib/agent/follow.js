import { pushQueue } from '../queue.js';
import { TRANSFER_TOOL_NAME } from './transfer.js';
export const MAX_TRANSFERS = 3;
export function follow(host, request) {
    const agents = request.agents ?? {};
    const entry = checkRoster(request.agent, agents);
    if (!request.messages) {
        throw new TypeError('A run that follows handoffs needs its messages to hand them on');
    }
    const resumed = request.resume ? resumedHop(request.runId ?? '', agents) : null;
    const first = resumed ?? { index: 0, id: entry, root: request.runId };
    return hops(host, request, { ...first, note: null, resume: request.resume === true });
}
async function* hops(host, request, first) {
    const hop = { ...first };
    const inputs = request.input ? hopInputs(request.input) : null;
    try {
        for (;;) {
            const transfer = yield* runHop(host, { request, hop, inputs });
            if (!transfer || hop.index === MAX_TRANSFERS) {
                return;
            }
            yield { type: 'transfer', from: hop.id, to: transfer.transferred, reason: transfer.reason };
            hop.note = `[Transferred from ${hop.id}: ${transfer.reason}]`;
            hop.id = transfer.transferred;
            hop.index++;
            hop.resume = false;
        }
    }
    finally {
        inputs?.stop();
    }
}
async function* runHop(host, { request, hop, inputs }) {
    const queue = inputs?.open() ?? null;
    let transfer = null;
    try {
        for await (const event of host.completion(hopRequest(request, hop, queue))) {
            hop.root ??= typeof event.runId === 'string' ? event.runId : undefined;
            if (event.type === 'tool-result' && event.name === TRANSFER_TOOL_NAME) {
                transfer = isTransfer(event.result) ? event.result : null;
            }
            else if (STOPPED.has(event.type)) {
                transfer = null;
            }
            else if (event.type === 'input') {
                inputs?.ack(event.id ?? event.text);
            }
            yield { ...event, agent: hop.id };
        }
    }
    finally {
        queue?.end();
    }
    return transfer;
}
function hopInputs(input) {
    const unacked = [];
    let queue = null;
    let stopped = false;
    readInput(input, (item) => {
        if (!stopped) {
            unacked.push(item);
            queue?.push(item);
        }
        return !stopped;
    }).catch(noop);
    return {
        open() {
            queue = pushQueue();
            for (const item of unacked) {
                queue.push(item);
            }
            return queue;
        },
        ack(key) {
            const at = unacked.findIndex((item) => (item.id ?? item.text) === key);
            if (at !== -1) {
                unacked.splice(at, 1);
            }
        },
        stop() {
            stopped = true;
        }
    };
}
async function readInput(input, take) {
    const iterator = input[Symbol.asyncIterator]();
    for (;;) {
        const next = await iterator.next();
        if (next.done || !take(next.value)) {
            return;
        }
    }
}
function noop() { }
function hopRequest(request, hop, input) {
    const run = {
        ...request,
        agent: hop.index === 0 ? request.agent : hopAgent(request.agents ?? {}, hop.id, hop.index),
        resume: hop.resume,
        runId: hop.index === 0 ? request.runId : `${hop.root}/${hop.index}-${hop.id}`,
        cacheKey: request.cacheKey === undefined ? undefined : `${request.cacheKey}/a-${hop.id}`,
        messages: hop.note === null ? request.messages : noted(request.messages ?? [], hop.note)
    };
    delete run.agents;
    delete run.hopLog;
    Object.assign(run, request.hopLog?.({ index: hop.index, agent: hop.id }));
    if (input) {
        run.input = input;
    }
    else {
        delete run.input;
    }
    if (!hop.resume) {
        delete run.recovery;
    }
    if (hop.resume && hop.index > 0) {
        delete run.messages;
    }
    return run;
}
const STOPPED = new Set(['paused', 'aborted', 'error']);
function hopAgent(agents, id, index) {
    const member = agents[id];
    return { ...member, id, handoffs: index === MAX_TRANSFERS ? null : member.handoffs };
}
function checkRoster(entry, agents) {
    if (!entry?.id) {
        throw new TypeError('A run that follows handoffs needs an entry agent with an id');
    }
    const reached = new Set();
    const queue = [entry];
    for (const agent of queue) {
        for (const { id } of agent.handoffs ?? []) {
            if (reached.has(id))
                continue;
            if (!agents[id]) {
                throw new TypeError(`Agent ${agent.id} hands to ${id}, which agents does not list`);
            }
            reached.add(id);
            queue.push({ ...agents[id], id });
        }
    }
    return entry.id;
}
function resumedHop(runId, agents) {
    const match = /^(.+)\/(\d+)-([^/]+)$/.exec(runId);
    return match && agents[match[3]]
        ? { index: Number(match[2]), id: match[3], root: match[1] }
        : null;
}
const TRANSFER_NOTE = /\n\n\[Transferred from [^\]\n]*: [^\n]*\]$/;
export function untransferred(text) {
    return text.replace(TRANSFER_NOTE, '');
}
function noted(messages, note) {
    const last = messages.findLastIndex((message) => message.role === 'user');
    return messages.map((message, index) => index === last ? { ...message, content: `${message.content}\n\n${note}` } : message);
}
function isTransfer(value) {
    const { transferred, reason } = Object(value);
    return typeof transferred === 'string' && typeof reason === 'string';
}
