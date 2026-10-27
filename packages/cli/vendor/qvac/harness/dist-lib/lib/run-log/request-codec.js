import crypto from 'crypto';
import { completionParams } from '../helpers/completion-params.js';
import { isRecord } from '../guards.js';
import { compactRequestHistory, materializeRequestHistory } from './history-codec.js';
export function toolsRef(tools) {
    return crypto.createHash('sha256').update(JSON.stringify(tools)).digest('hex');
}
export function requestRecord({ round, attempt, droppedTurns, params }) {
    const { modelId, history, tools, generationParams, responseFormat, toolDialect, kvCache } = params;
    return {
        version: 1,
        type: 'request',
        round,
        attempt,
        droppedTurns,
        keep: 0,
        messages: history,
        tools: tools ? { ref: toolsRef(tools), block: tools } : undefined,
        params: { modelId, generationParams, responseFormat, toolDialect, kvCache }
    };
}
export class RequestEncoder {
    previous = [];
    written = new Set();
    encode(whole, base) {
        if (!Array.isArray(whole.messages)) {
            throw new Error('A request record is encoded from its full message list');
        }
        const keys = whole.messages.map((message) => JSON.stringify(message));
        let keep = 0;
        while (keep < keys.length && keys[keep] === this.previous[keep]) {
            keep++;
        }
        const tools = whole.tools && this.written.has(whole.tools.ref) ? { ref: whole.tools.ref } : whole.tools;
        this.previous = keys;
        if (tools) {
            this.written.add(tools.ref);
        }
        return {
            ...whole,
            keep,
            messages: compactRequestHistory(whole.messages.slice(keep), base),
            tools
        };
    }
}
export class RequestDecoder {
    previous = [];
    blocks = new Map();
    decode(record, base) {
        if (record.keep > this.previous.length) {
            throw new Error(`Request keeps ${record.keep} messages; the previous request had ${this.previous.length}`);
        }
        const appended = materializeRequestHistory(record.messages, base);
        if (!appended.every(isMessage)) {
            throw new Error('Request history holds a message without a role and text content');
        }
        const history = [...this.previous.slice(0, record.keep), ...appended];
        this.previous = history;
        const { modelId, generationParams, responseFormat, toolDialect, kvCache } = record.params;
        return completionParams({
            modelId,
            history,
            tools: record.tools && this.tools(record.tools),
            generationParams,
            responseFormat,
            toolDialect,
            kvCache
        });
    }
    tools({ ref, block }) {
        if (block) {
            if (toolsRef(block) !== ref) {
                throw new Error(`Request tool block does not hash to ${ref}`);
            }
            this.blocks.set(ref, block);
        }
        const tools = this.blocks.get(ref);
        if (!tools) {
            throw new Error(`Request names tool block ${ref} before any record carries it`);
        }
        return tools;
    }
}
function isMessage(value) {
    return isRecord(value) && typeof value.role === 'string' && typeof value.content === 'string';
}
