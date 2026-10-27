import fs from 'fs';
import { join } from 'path';
import { WriteQueue } from './write-queue.js';
import { isRecord, safeName } from './guards.js';
const CALLS_FILE = 'calls.jsonl';
const BLOCKS_DIR = 'blocks';
const MAX_CALLS_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LINES_READ = 600;
export class InferenceCallStore {
    _dir;
    _writes;
    constructor(dir) {
        this._dir = dir;
        this._writes = new WriteQueue();
    }
    record(chatId, entry) {
        return this._writes.run(chatId, 'inference-call', async () => {
            const { system, tools, promptPrefix, rest } = split(entry.call);
            const chatDir = join(this._dir, safeName(chatId));
            await fs.promises.mkdir(join(chatDir, BLOCKS_DIR), { recursive: true });
            const callsPath = join(chatDir, CALLS_FILE);
            if (((await sizeOf(callsPath)) ?? 0) > MAX_CALLS_BYTES) {
                return;
            }
            if (promptPrefix) {
                const blockPath = join(chatDir, BLOCKS_DIR, `${safeName(promptPrefix)}.json`);
                await fs.promises
                    .writeFile(blockPath, JSON.stringify({ system, tools }), { flag: 'wx' })
                    .catch(noop);
            }
            const line = JSON.stringify({ runId: entry.runId, at: entry.at, ...rest });
            await fs.promises.appendFile(callsPath, `${line}\n`);
        });
    }
    recordSent(chatId, sent) {
        return this._writes.run(chatId, 'inference-sent', async () => {
            const chatDir = join(this._dir, safeName(chatId));
            const callsPath = join(chatDir, CALLS_FILE);
            const size = await sizeOf(callsPath);
            if (size === null || size > MAX_CALLS_BYTES) {
                return;
            }
            const line = JSON.stringify({
                sentFor: sent.round,
                sentRun: sent.runId,
                sent: sent.messages,
                tokens: sent.tokens,
                outcome: sent.outcome,
                reason: sent.reason
            });
            await fs.promises.appendFile(callsPath, `${line}\n`);
        });
    }
    recordOutcome(chatId, verdict) {
        return this._writes.run(chatId, 'inference-outcome', async () => {
            const callsPath = join(this._dir, safeName(chatId), CALLS_FILE);
            const size = await sizeOf(callsPath);
            if (size === null || size > MAX_CALLS_BYTES) {
                return;
            }
            const line = JSON.stringify({
                outcomeFor: verdict.runId,
                outcome: verdict.outcome,
                reason: verdict.reason
            });
            await fs.promises.appendFile(callsPath, `${line}\n`);
        });
    }
    list(chatId) {
        const chatDir = join(this._dir, safeName(chatId));
        const all = readLines(join(chatDir, CALLS_FILE));
        const lines = all.slice(-MAX_LINES_READ);
        const blocks = new Map();
        const entries = [];
        for (const line of lines) {
            const parsed = parseLine(line);
            if (!parsed) {
                continue;
            }
            if ('sentFor' in parsed) {
                foldSent(entries, parsed);
                continue;
            }
            if ('outcomeFor' in parsed) {
                foldOutcome(entries, parsed);
                continue;
            }
            const { runId, at, ...rest } = parsed;
            const prefix = typeof rest.promptPrefix === 'string' ? rest.promptPrefix : '';
            const block = prefix ? readBlock(blocks, chatDir, prefix) : null;
            const messages = Array.isArray(rest.messages) ? rest.messages : [];
            entries.push({
                runId: String(runId ?? ''),
                at: Number(at ?? 0),
                call: {
                    ...rest,
                    tools: block ? block.tools : (rest.tools ?? null),
                    messages: block?.system
                        ? [{ role: 'system', content: block.system }, ...messages]
                        : messages
                }
            });
        }
        return { calls: entries, truncated: all.length > lines.length };
    }
    forget(chatId) {
        return this._writes.run(chatId, 'inference-forget', () => fs.promises.rm(join(this._dir, safeName(chatId)), { recursive: true, force: true }));
    }
    async sweep(limits = {}) {
        const maxTotalBytes = limits.maxTotalBytes ?? MAX_TOTAL_BYTES;
        const maxAgeMs = limits.maxAgeMs ?? MAX_AGE_MS;
        const chats = await this._chatSizes();
        const cutoff = Date.now() - maxAgeMs;
        const aged = chats.filter((chat) => chat.mtimeMs < cutoff);
        let removed = 0;
        for (const chat of aged) {
            await this._drop(chat.name);
            removed++;
        }
        const kept = chats
            .filter((chat) => chat.mtimeMs >= cutoff)
            .sort((a, b) => a.mtimeMs - b.mtimeMs);
        let total = kept.reduce((sum, chat) => sum + chat.bytes, 0);
        for (const chat of kept) {
            if (total <= maxTotalBytes)
                break;
            await this._drop(chat.name);
            total -= chat.bytes;
            removed++;
        }
        return { removed };
    }
    async _drop(name) {
        await fs.promises.rm(join(this._dir, name), { recursive: true, force: true });
    }
    async _chatSizes() {
        let names;
        try {
            names = await fs.promises.readdir(this._dir);
        }
        catch {
            return [];
        }
        const chats = [];
        for (const name of names) {
            const measured = await measureDir(join(this._dir, name));
            if (measured) {
                chats.push({ name, ...measured });
            }
        }
        return chats;
    }
}
async function measureDir(dir) {
    let bytes = 0;
    let mtimeMs = 0;
    const visit = async (path) => {
        const stat = await fs.promises.stat(path);
        if (stat.isDirectory()) {
            for (const child of await fs.promises.readdir(path)) {
                await visit(join(path, child));
            }
            return;
        }
        bytes += stat.size;
        mtimeMs = Math.max(mtimeMs, stat.mtimeMs);
    };
    try {
        await visit(dir);
    }
    catch {
        return null;
    }
    return { bytes, mtimeMs };
}
function foldSent(entries, parsed) {
    const round = Number(parsed.sentFor ?? -1);
    const runId = parsed.sentRun === undefined ? null : String(parsed.sentRun);
    for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        if (runId !== null && entry?.runId !== runId) {
            continue;
        }
        if (entry && Number(entry.call.round ?? -1) === round) {
            entry.call.sent = parsed.sent ?? null;
            entry.call.tokens = parsed.tokens ?? null;
            entry.call.outcome = parsed.outcome ?? null;
            entry.call.reason = parsed.reason ?? null;
            return;
        }
    }
}
function foldOutcome(entries, parsed) {
    const runId = String(parsed.outcomeFor ?? '');
    for (const entry of entries) {
        if (entry.runId !== runId || entry.call.outcome)
            continue;
        entry.call.outcome = parsed.outcome ?? null;
        entry.call.reason = parsed.reason ?? null;
    }
}
function split(call) {
    const { messages, tools, ...rest } = call;
    const turns = Array.isArray(messages) ? messages : [];
    const promptPrefix = typeof rest.promptPrefix === 'string' ? rest.promptPrefix : '';
    if (!promptPrefix) {
        return { system: null, tools: null, promptPrefix, rest: { ...rest, messages: turns, tools } };
    }
    const system = turns.find((turn) => isSystemTurn(turn));
    return {
        system: system ? String(system.content) : null,
        tools: tools ?? null,
        promptPrefix,
        rest: { ...rest, messages: turns.filter((turn) => !isSystemTurn(turn)) }
    };
}
function isSystemTurn(turn) {
    return isRecord(turn) && turn.role === 'system';
}
function readBlock(cache, chatDir, prefix) {
    const hit = cache.get(prefix);
    if (hit) {
        return hit;
    }
    const raw = readFile(join(chatDir, BLOCKS_DIR, `${safeName(prefix)}.json`));
    if (!raw) {
        return null;
    }
    const parsed = parseBlock(raw);
    if (parsed) {
        cache.set(prefix, parsed);
    }
    return parsed;
}
function parseLine(line) {
    try {
        const value = JSON.parse(line);
        return isRecord(value) ? value : null;
    }
    catch {
        return null;
    }
}
function parseBlock(raw) {
    const parsed = parseLine(raw);
    return parsed ? { system: parsed.system ?? null, tools: parsed.tools ?? null } : null;
}
function readLines(path) {
    const raw = readFile(path);
    return raw ? raw.split('\n').filter((line) => line.length > 0) : [];
}
function readFile(path) {
    try {
        return fs.readFileSync(path, 'utf8');
    }
    catch {
        return null;
    }
}
async function sizeOf(path) {
    try {
        return (await fs.promises.stat(path)).size;
    }
    catch {
        return null;
    }
}
function noop() { }
