import fs from 'fs';
import { dirname } from 'path';
import FileLog from 'bare-file-logger';
import SystemLog from 'bare-system-logger';
import { LEVEL_PRIORITIES } from '@qvac/logging/constants';
import { LogBuffer } from './log-buffer.js';
import b4a from 'b4a';
const SCOPE = 'qvac-app-core';
const LOG_BUFFER_CAP = 1000;
export function isLogLevel(value) {
    return typeof value === 'string' && Object.hasOwn(LEVEL_PRIORITIES, value);
}
export function toLoggerOptions(flags) {
    return {
        logFile: flags.logFile || undefined,
        logLevel: isLogLevel(flags.logLevel) ? flags.logLevel : undefined,
        verbose: flags.logVerbose ? true : undefined
    };
}
export class Logger {
    _muted;
    _dev;
    _verbose;
    _level;
    _system;
    _file;
    _seq;
    _subscribers;
    _buffer;
    constructor({ dev = false, verbose = false, logFile, logLevel = 'info', logFileMaxSize } = {}) {
        this._muted = false;
        this._dev = dev;
        this._verbose = verbose;
        this._level = isLogLevel(logLevel) ? logLevel : 'info';
        this._system = new SystemLog();
        if (logFile) {
            fs.mkdirSync(dirname(logFile), { recursive: true });
        }
        this._file = logFile
            ? new FileLog(logFile, {
                maxSize: logFileMaxSize || 100_000_000,
                rotate: (path) => `${path}.1`
            })
            : null;
        this._seq = 0;
        this._subscribers = new Set();
        this._buffer = new LogBuffer(LOG_BUFFER_CAP);
    }
    getLevel() {
        return this._level;
    }
    mute() {
        this._muted = true;
    }
    unmute() {
        this._muted = false;
    }
    debug(...args) {
        this._write('debug', ...args);
    }
    info(...args) {
        this._write('info', ...args);
    }
    warn(...args) {
        this._write('warn', ...args);
    }
    error(...args) {
        this._write('error', ...args);
    }
    subscribe(listener) {
        this._subscribers.add(listener);
    }
    unsubscribe(listener) {
        this._subscribers.delete(listener);
    }
    backfill() {
        return this._buffer.snapshot();
    }
    onRotate(listener) {
        this._file?.on('rotate', listener);
    }
    close() {
        this._file?.close();
        this._file = null;
    }
    appendClient(input) {
        if (this._muted)
            return;
        this._sink({
            level: input.level,
            scope: [...input.scope],
            message: input.message,
            origin: 'client',
            originDeviceId: input.originDeviceId,
            at: input.at
        });
    }
    _write(level, ...args) {
        if (this._muted || this._level === 'off')
            return;
        if (LEVEL_PRIORITIES[level] > LEVEL_PRIORITIES[this._level])
            return;
        this._sink({ level, ...toParts(args), origin: 'core', at: Date.now() });
    }
    _sink(parts) {
        const record = { ...parts, seq: this._seq++ };
        const rendered = renderRecord(record);
        if (this._verbose || (this._dev && this._level === 'debug')) {
            const log = console[record.level] || console.log;
            log(record.level.padEnd(5), ...rendered);
        }
        this._system[record.level](...rendered);
        if (this._file) {
            this._file[record.level](...rendered);
        }
        this._buffer.push(record);
        for (const listener of this._subscribers) {
            listener(record);
        }
    }
}
function renderRecord(record) {
    const tags = [SCOPE, ...record.scope];
    if (record.origin === 'client') {
        tags.push(record.originDeviceId ? `client:${b4a.toHex(record.originDeviceId).slice(0, 8)}` : 'client');
    }
    return [`[${tags.join(':')}]`, new Date(record.at).toISOString(), '-', record.message];
}
function toParts(args) {
    const [rawScope, rawMessage, ...rest] = args;
    const scope = scopeOf(rawScope);
    const head = headOf(rawMessage);
    const tail = rest.map(formatArg).join(' ');
    return { scope, message: tail ? `${head} ${tail}`.trim() : head };
}
function scopeOf(rawScope) {
    if (typeof rawScope === 'string') {
        return [rawScope];
    }
    if (Array.isArray(rawScope) && rawScope.every((s) => typeof s === 'string')) {
        return [...rawScope];
    }
    return [];
}
function headOf(rawMessage) {
    if (typeof rawMessage === 'string')
        return rawMessage;
    return rawMessage === undefined ? '' : formatArg(rawMessage);
}
function formatArg(value) {
    if (typeof value === 'string')
        return value;
    if (value instanceof Error) {
        return value.stack ?? value.message;
    }
    try {
        return JSON.stringify(value, errorsAsText) ?? String(value);
    }
    catch {
        return String(value);
    }
}
function errorsAsText(_key, value) {
    return value instanceof Error ? (value.stack ?? value.message) : value;
}
