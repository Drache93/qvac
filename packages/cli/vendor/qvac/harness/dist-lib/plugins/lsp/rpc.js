import b4a from 'b4a';
import { isRecord } from '../../lib/guards.js';
const HEADER_END = b4a.from('\r\n\r\n');
const CONTENT_LENGTH = /^content-length:\s*(\d+)\s*$/im;
export function encodeMessage(message) {
    const body = JSON.stringify({ jsonrpc: '2.0', ...message });
    return b4a.from(`Content-Length: ${b4a.byteLength(body)}\r\n\r\n${body}`);
}
export class FrameDecoder {
    _buffer = b4a.alloc(0);
    push(chunk) {
        this._buffer = this._buffer.byteLength ? b4a.concat([this._buffer, chunk]) : chunk;
        const messages = [];
        while (true) {
            const end = b4a.indexOf(this._buffer, HEADER_END);
            if (end === -1) {
                break;
            }
            const length = CONTENT_LENGTH.exec(b4a.toString(this._buffer, 'ascii', 0, end));
            if (!length) {
                throw new Error('language server sent a frame with no Content-Length');
            }
            const start = end + HEADER_END.byteLength;
            const stop = start + Number(length[1]);
            if (this._buffer.byteLength < stop) {
                break;
            }
            const message = JSON.parse(b4a.toString(this._buffer, 'utf8', start, stop));
            if (isRecord(message)) {
                messages.push(toMessage(message));
            }
            this._buffer = this._buffer.subarray(stop);
        }
        return messages;
    }
}
function toMessage(value) {
    const { id, method, params, result, error } = value;
    return {
        id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        method: typeof method === 'string' ? method : undefined,
        params,
        result,
        error: isRecord(error)
            ? { code: Number(error.code), message: String(error.message) }
            : undefined
    };
}
function configurationAnswer(params) {
    const items = isRecord(params) && Array.isArray(params.items) ? params.items : [];
    return items.map(() => null);
}
export class RpcConnection {
    _write;
    _onNotification;
    _decoder = new FrameDecoder();
    _pending = new Map();
    _nextId = 1;
    _closed = null;
    constructor(write, onNotification) {
        this._write = write;
        this._onNotification = onNotification;
    }
    request(method, params, options = {}) {
        const { signal, timeoutMs } = options;
        if (this._closed) {
            return Promise.reject(this._closed);
        }
        if (signal?.aborted) {
            return Promise.reject(abortError(signal));
        }
        const id = this._nextId++;
        const answer = new Promise((resolve, reject) => this._pending.set(id, { resolve, reject }));
        const cancel = (error) => {
            const pending = this._take(id);
            if (!pending) {
                return;
            }
            this._send({ method: '$/cancelRequest', params: { id } });
            pending.reject(error);
        };
        const onAbort = () => cancel(abortError(signal));
        const late = () => cancel(new Error(`${method} timed out after ${timeoutMs} ms`));
        const timer = timeoutMs ? setTimeout(late, timeoutMs) : undefined;
        signal?.addEventListener('abort', onAbort);
        this._send({ id, method, params });
        return answer.finally(() => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        });
    }
    notify(method, params) {
        if (!this._closed) {
            this._send({ method, params });
        }
    }
    receive(chunk) {
        for (const message of this._decoder.push(chunk)) {
            this._dispatch(message);
        }
    }
    close(reason) {
        if (this._closed)
            return;
        this._closed = reason;
        const pending = [...this._pending.values()];
        this._pending.clear();
        for (const call of pending) {
            call.reject(reason);
        }
    }
    _take(id) {
        const pending = this._pending.get(id);
        this._pending.delete(id);
        return pending;
    }
    _dispatch(message) {
        const { id, method } = message;
        if (method !== undefined && id !== undefined) {
            const result = method === 'workspace/configuration' ? configurationAnswer(message.params) : null;
            this._send({ id, result });
            return;
        }
        if (method !== undefined) {
            this._onNotification(method, message.params);
            return;
        }
        const pending = typeof id === 'number' ? this._take(id) : undefined;
        if (!pending) {
            return;
        }
        if (message.error) {
            pending.reject(new Error(message.error.message));
            return;
        }
        pending.resolve(message.result ?? null);
    }
    _send(message) {
        this._write(encodeMessage(message));
    }
}
function abortError(signal) {
    const reason = signal?.reason;
    return reason instanceof Error ? reason : new Error('aborted');
}
