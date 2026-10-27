import { isRecord } from '../../lib/guards.js';
const TOOL_RESULT = /^\[Tool: (.+?) \((.+?)\)\]\n?/;
export function story(input) {
    const teller = new Teller(input);
    const history = Array.isArray(input.context.history) ? input.context.history : [];
    for (const message of history) {
        teller.add(Object(message));
    }
    teller.unanswered();
    const asked = Object(history.find((message) => Object(message).role === 'user')).content;
    return { prompt: request(asked), rounds: teller.rounds, tools: tally(teller.rounds) };
}
class Teller {
    rounds = [];
    input;
    failures;
    roundMetrics;
    toolMetrics;
    timed = new Set();
    told = new Set();
    constructor(input) {
        const metrics = Object(input.context.metrics);
        this.input = input;
        this.failures = isRecord(input.context.failureResults) ? input.context.failureResults : {};
        this.roundMetrics = Array.isArray(metrics.rounds) ? metrics.rounds : [];
        this.toolMetrics = Array.isArray(metrics.tools) ? metrics.tools : [];
    }
    add(entry) {
        if (entry.role === 'assistant') {
            this.open(entry);
            return;
        }
        const reply = replyOf(entry, this.failures);
        const current = this.rounds.at(-1);
        if (reply && current) {
            current.calls.push(this.call(current.round, reply));
        }
    }
    open(entry) {
        const round = this.rounds.length;
        const measured = Object(this.roundMetrics.find((item) => Object(item).round === round));
        this.rounds.push({
            round,
            text: prose(entry.content),
            calls: [],
            durationMs: typeof measured.durationMs === 'number' ? measured.durationMs : null,
            tokens: typeof measured.generatedTokens === 'number' ? measured.generatedTokens : null,
            step: this.input.requests.get(round) ?? null
        });
    }
    unanswered() {
        for (const [key, seen] of this.input.calls) {
            const round = this.rounds[Number(key.split(':')[0])];
            if (!this.told.has(key) && round) {
                const id = key.slice(key.indexOf(':') + 1);
                round.calls.push({
                    ...this.call(round.round, { name: seen.name, id, result: undefined }),
                    outcome: this.input.running ? 'running' : 'pending',
                    detail: this.input.running ? 'running' : 'no result'
                });
            }
        }
    }
    call(round, reply) {
        const key = `${round}:${reply.id}`;
        this.told.add(key);
        const [outcome, detail] = judge(reply.result);
        const seen = this.input.calls.get(key);
        return {
            round,
            id: reply.id,
            name: reply.name,
            args: seen?.args,
            outcome,
            detail,
            result: reply.result,
            approved: this.input.approvals.get(key) ?? null,
            durationMs: this.duration(round, reply.name),
            step: seen?.step ?? null
        };
    }
    duration(round, name) {
        const at = this.toolMetrics.findIndex((item, index) => !this.timed.has(index) && Object(item).round === round && Object(item).name === name);
        this.timed.add(at);
        const measured = Object(this.toolMetrics[at]).durationMs;
        return typeof measured === 'number' ? measured : null;
    }
}
function replyOf(entry, failures) {
    if (entry.type === 'qvac-failure-result-ref' && typeof entry.ref === 'string') {
        const kept = Object(failures[entry.ref]);
        const result = Object(kept.result);
        return { name: String(kept.name ?? '?'), id: String(entry.callId), result: result.value };
    }
    if (entry.role !== 'tool' || typeof entry.content !== 'string') {
        return null;
    }
    const head = TOOL_RESULT.exec(entry.content);
    if (!head) {
        return null;
    }
    return {
        name: head[1] ?? '?',
        id: head[2] ?? '?',
        result: parse(entry.content.slice(head[0].length))
    };
}
function judge(result) {
    const body = Object(result);
    if (body.denied === true) {
        return ['denied', 'declined'];
    }
    if (body.guidance === true) {
        return ['rejected', line(body.error)];
    }
    const error = errorOf(result);
    return error === null ? ['ok', ''] : ['failed', label(error, body)];
}
function errorOf(result) {
    if (typeof result === 'string') {
        return /^(error|failed)\b/i.test(result.trim()) ? result : null;
    }
    const body = Object(result);
    if (body.error !== undefined && body.error !== null && body.error !== false) {
        return typeof body.error === 'string'
            ? body.error
            : String(Object(body.error).message ?? JSON.stringify(body.error));
    }
    return body.ok === false ? String(body.message ?? 'not ok') : null;
}
function label(error, body) {
    const status = [body.status, body.statusCode, Object(body.error).status].find((value) => typeof value === 'number' && value >= 400);
    if (typeof status === 'number') {
        return `HTTP ${status}`;
    }
    const named = /\b(?:HTTP|status(?: code)?)\D{0,3}([45]\d\d)\b/i.exec(error);
    return named ? `HTTP ${named[1]}` : line(error);
}
function tally(rounds) {
    const tools = new Map();
    for (const call of rounds.flatMap((round) => round.calls)) {
        const tool = tools.get(call.name) ?? {
            name: call.name,
            calls: 0,
            outcomes: { ok: 0, failed: 0, rejected: 0, denied: 0, pending: 0, running: 0 },
            problems: []
        };
        tool.calls++;
        tool.outcomes[call.outcome]++;
        if (call.outcome !== 'ok') {
            const known = tool.problems.find((problem) => problem.label === call.detail);
            if (known) {
                known.count++;
            }
            else {
                tool.problems.push({ label: call.detail, count: 1 });
            }
        }
        tools.set(call.name, tool);
    }
    return [...tools.values()].sort((a, b) => b.calls - a.calls);
}
function prose(content) {
    const text = typeof content === 'string' ? content : '';
    return text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
        .replace(/<function=[\s\S]*?<\/function>/g, '')
        .trim();
}
function request(content) {
    const text = typeof content === 'string' ? content : '';
    return text.replace(/^\[Current local time:[^\]]*\]\s*/, '').trim();
}
function parse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function line(value) {
    const first = String(value ?? '')
        .split('\n')[0]
        ?.trim() ?? '';
    return first.length > 90 ? `${first.slice(0, 90)}…` : first;
}
