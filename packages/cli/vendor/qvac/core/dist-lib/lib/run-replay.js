import fs from 'fs';
import { join } from 'path';
import { isRecord, safeName } from './guards.js';
export const LOCAL_HOLDER = 'local';
export class RunReplayStore {
    _dir;
    constructor(dir) {
        this._dir = dir;
    }
    async started() {
        try {
            await fs.promises.stat(this._dir);
            return true;
        }
        catch {
            return false;
        }
    }
    async start() {
        await fs.promises.mkdir(this._dir, { recursive: true });
    }
    async load(chat) {
        const runs = new Map();
        for (const record of await this._records(chat)) {
            if (Array.isArray(record.messages)) {
                runs.set(record.runId, record.messages.filter(isChatMessage));
            }
        }
        return runs;
    }
    async loadAsked(chat) {
        const asked = new Map();
        for (const record of await this._records(chat)) {
            if (typeof record.asked === 'string') {
                asked.set(record.runId, record.asked);
            }
        }
        return asked;
    }
    async save({ holder, chatId }, runId, { messages, asked }) {
        const chatDir = this._chatDir(holder, chatId);
        await fs.promises.mkdir(chatDir, { recursive: true });
        await fs.promises.writeFile(join(chatDir, `${safeName(runId)}.json`), JSON.stringify({ runId, messages, asked }));
    }
    async _records({ holder, chatId }) {
        const chatDir = this._chatDir(holder, chatId);
        let names;
        try {
            names = await fs.promises.readdir(chatDir);
        }
        catch {
            return [];
        }
        const records = [];
        for (const name of names) {
            if (!name.endsWith('.json'))
                continue;
            const parsed = JSON.parse(await fs.promises.readFile(join(chatDir, name), 'utf8'));
            if (isRecord(parsed) && typeof parsed.runId === 'string') {
                records.push({ runId: parsed.runId, messages: parsed.messages, asked: parsed.asked });
            }
        }
        return records;
    }
    async forget(chatId, holder) {
        const holders = holder === undefined ? await this._holders() : [holder];
        for (const each of holders) {
            await fs.promises.rm(this._chatDir(each, chatId), { recursive: true, force: true });
        }
    }
    async clear(holder) {
        await fs.promises.rm(join(this._dir, safeName(holder)), { recursive: true, force: true });
    }
    _chatDir(holder, chatId) {
        return join(this._dir, safeName(holder), safeName(chatId));
    }
    async _holders() {
        try {
            return await fs.promises.readdir(this._dir);
        }
        catch {
            return [];
        }
    }
}
export function trackSentRun(cacheKey) {
    let used = false;
    let last = null;
    return {
        get used() {
            return used;
        },
        observe(call) {
            if (cacheKey && call.cacheKey === cacheKey) {
                used = true;
                last = call.droppedTurns ? null : call.messages;
            }
            else if (used) {
                last = null;
            }
        },
        turns: (inputLength) => appendedTurns(last, inputLength)
    };
}
export function appendedTurns(sent, inputLength) {
    if (!Array.isArray(sent))
        return null;
    const offset = (isRecord(sent[0]) && sent[0].role === 'system' ? 1 : 0) + inputLength;
    if (sent.length < offset) {
        return null;
    }
    const turns = sent
        .slice(offset)
        .map((turn) => (isRecord(turn) ? { role: turn.role, content: turn.content } : null));
    return turns.every(isChatMessage) ? turns : null;
}
export function isChatMessage(value) {
    return (isRecord(value) &&
        (value.role === 'user' || value.role === 'assistant' || value.role === 'tool') &&
        typeof value.content === 'string');
}
