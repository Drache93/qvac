import b4a from 'b4a';
import { AbortController } from 'bare-abort-controller';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import defaultFetch from '#fetch';
import { errorMessage } from '../guards.js';
import { HarnessLog } from '../log.js';
const rangeFetch = defaultFetch;
export const GGUF_HEADER_BYTES = 1_048_576;
export const GGUF_HEADER_TIMEOUT_MS = 30_000;
export const GGUF_HEADER_ATTEMPTS = 3;
export const GGUF_STUB_MAX_BYTES = 33_554_432;
export const GGUF_STUB_TIMEOUT_MS = 60_000;
const MAX_ALIGNMENT = 1_048_576;
const UINT8 = 0;
const INT8 = 1;
const UINT16 = 2;
const INT16 = 3;
const UINT32 = 4;
const INT32 = 5;
const FLOAT32 = 6;
const BOOL = 7;
const STRING = 8;
const ARRAY = 9;
const UINT64 = 10;
const INT64 = 11;
const FLOAT64 = 12;
export function isRemoteSource(src) {
    return /^https?:\/\//i.test(src);
}
export function localSourcePath(src) {
    if (/^file:/i.test(src)) {
        return filePath(src);
    }
    if (/^[a-z][a-z0-9+.-]+:/i.test(src))
        return null;
    if (src === '~') {
        return os.homedir();
    }
    if (src.startsWith('~/')) {
        return path.join(os.homedir(), src.slice(2));
    }
    return src;
}
function filePath(src) {
    try {
        return fileURLToPath(src);
    }
    catch {
        return null;
    }
}
export function readGgufHeaderBytes(src, opts = {}) {
    const maxBytes = opts.maxBytes ?? GGUF_HEADER_BYTES;
    const fetch = opts.fetch ?? rangeFetch;
    return isRemoteSource(src)
        ? withDeadline(GGUF_HEADER_TIMEOUT_MS, (signal) => fetchRange(src, { start: 0, length: maxBytes, fetch, signal }))
        : readLocalHead(src, maxBytes);
}
export function fetchGgufStub(src, opts = {}) {
    const fetch = opts.fetch ?? rangeFetch;
    const maxBytes = opts.maxBytes ?? GGUF_STUB_MAX_BYTES;
    return withDeadline(GGUF_STUB_TIMEOUT_MS, (signal) => readStub(src, { fetch, maxBytes, signal }));
}
async function readStub(src, { fetch, maxBytes, signal }) {
    let bytes = b4a.alloc(0);
    let want = Math.min(GGUF_HEADER_BYTES, maxBytes);
    for (;;) {
        const start = bytes.byteLength;
        const more = await fetchRange(src, { start, length: want - start, fetch, signal });
        if (more === null) {
            return null;
        }
        bytes = b4a.concat([bytes, more]);
        const dataOffset = ggufDataOffset(bytes);
        if (dataOffset !== null) {
            return padded(bytes, dataOffset);
        }
        if (more.byteLength < want - start || want >= maxBytes) {
            return null;
        }
        want = Math.min(want * 2, maxBytes);
    }
}
export function ggufDataOffset(bytes) {
    if (bytes.byteLength < 24 || b4a.toString(bytes.subarray(0, 4), 'latin1') !== 'GGUF') {
        return null;
    }
    const c = {
        view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        bytes,
        offset: 8
    };
    const tensors = readU64(c);
    const alignment = skipMetadata(c, readU64(c));
    if (alignment === null || !skipTensorInfos(c, tensors)) {
        return null;
    }
    return Math.ceil(c.offset / alignment) * alignment;
}
function skipTensorInfos(c, count) {
    for (let i = 0; i < count; i += 1) {
        if (readString(c) === null || !has(c, 4)) {
            return false;
        }
        const dims = readU32(c);
        if (!has(c, dims * 8 + 12)) {
            return false;
        }
        c.offset += dims * 8 + 12;
    }
    return true;
}
function skipMetadata(c, count) {
    let alignment = 32;
    for (let i = 0; i < count; i += 1) {
        const key = readString(c);
        if (key === null || !has(c, 4)) {
            return null;
        }
        const value = readValue(c, readU32(c));
        if (!value.ok) {
            return null;
        }
        if (key === 'general.alignment') {
            if (!isAlignment(value.num)) {
                return null;
            }
            alignment = value.num;
        }
    }
    return alignment;
}
function isAlignment(value) {
    return (value !== undefined &&
        Number.isInteger(value) &&
        value > 0 &&
        value <= MAX_ALIGNMENT &&
        (value & (value - 1)) === 0);
}
function padded(bytes, length) {
    if (length <= bytes.byteLength) {
        return bytes.subarray(0, length);
    }
    const stub = b4a.alloc(length);
    stub.set(bytes);
    return stub;
}
async function withDeadline(ms, run) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(undefined), ms);
    try {
        return await run(controller.signal);
    }
    finally {
        clearTimeout(timeout);
    }
}
async function fetchRange(src, range) {
    for (let attempt = 1; attempt <= GGUF_HEADER_ATTEMPTS; attempt++) {
        const read = await requestRange(src, range);
        if (read.kind === 'read') {
            return read.bytes;
        }
        HarnessLog.warn('gguf header read failed', { host: hostOf(src), attempt, cause: read.cause });
        if (!read.transient || range.signal.aborted) {
            return null;
        }
    }
    return null;
}
async function requestRange(src, { start, length, fetch, signal }) {
    let response;
    try {
        response = await fetch(src, {
            headers: { Range: `bytes=${start}-${start + length - 1}` },
            signal
        });
    }
    catch (err) {
        return { kind: 'failed', transient: true, cause: failureOf(err) };
    }
    const refused = refusedRange(response, { start, length });
    if (refused) {
        return refused;
    }
    try {
        return {
            kind: 'read',
            bytes: new Uint8Array(await response.arrayBuffer()).subarray(0, length)
        };
    }
    catch (err) {
        return { kind: 'failed', transient: true, cause: failureOf(err) };
    }
}
function refusedRange(response, { start, length }) {
    if (!response.ok) {
        return {
            kind: 'failed',
            transient: retryableStatus(response.status),
            cause: `HTTP ${response.status}`
        };
    }
    if (start > 0 && response.status !== 206) {
        return { kind: 'failed', transient: false, cause: `HTTP ${response.status} for a range` };
    }
    const announced = response.headers.get('content-length');
    return announced === null || !(Number(announced) <= length)
        ? { kind: 'failed', transient: false, cause: `content-length ${announced ?? 'missing'}` }
        : null;
}
function failureOf(err) {
    const cause = err instanceof Error ? err.cause : undefined;
    return cause === undefined ? errorMessage(err) : `${errorMessage(err)}: ${errorMessage(cause)}`;
}
function retryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}
function hostOf(src) {
    try {
        return new URL(src).host;
    }
    catch {
        return '';
    }
}
async function readLocalHead(src, maxBytes) {
    const file = localSourcePath(src);
    if (file === null) {
        return null;
    }
    let handle;
    try {
        handle = await fs.promises.open(file, 'r');
        const buffer = b4a.allocUnsafe(maxBytes);
        const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, bytesRead);
    }
    catch {
        return null;
    }
    finally {
        await handle?.close();
    }
}
export function parseGgufHeader(bytes) {
    if (bytes.byteLength < 24)
        return null;
    if (b4a.toString(bytes.subarray(0, 4), 'latin1') !== 'GGUF')
        return null;
    const c = {
        view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        bytes,
        offset: 16
    };
    if (c.view.getUint32(4, true) < 2) {
        return null;
    }
    const count = readU64(c);
    const header = {};
    const contextLengths = new Map();
    for (let i = 0; i < count; i += 1) {
        const key = readString(c);
        if (key === null || !has(c, 4)) {
            break;
        }
        const value = readValue(c, readU32(c), key === 'general.tags');
        if (!value.ok) {
            break;
        }
        if (key === 'general.architecture') {
            header.architecture = value.str;
        }
        else if (key === 'general.name') {
            header.name = value.str;
        }
        else if (key === 'general.type') {
            header.type = value.str;
        }
        else if (key === 'general.license') {
            header.license = value.str;
        }
        else if (key === 'general.size_label') {
            header.sizeLabel = value.str;
        }
        else if (key === 'general.tags') {
            header.tags = value.strs;
        }
        else if (key.endsWith('.context_length')) {
            contextLengths.set(key, value.num);
        }
    }
    header.contextLength =
        contextLengths.get(`${header.architecture}.context_length`) ??
            contextLengths.values().next().value;
    return header;
}
function readValue(c, type, collect = false) {
    switch (type) {
        case UINT8:
        case BOOL:
            return fixed(c, 1, () => c.view.getUint8(c.offset));
        case INT8:
            return fixed(c, 1, () => c.view.getInt8(c.offset));
        case UINT16:
            return fixed(c, 2, () => c.view.getUint16(c.offset, true));
        case INT16:
            return fixed(c, 2, () => c.view.getInt16(c.offset, true));
        case UINT32:
            return fixed(c, 4, () => c.view.getUint32(c.offset, true));
        case INT32:
            return fixed(c, 4, () => c.view.getInt32(c.offset, true));
        case FLOAT32:
            return fixed(c, 4, () => c.view.getFloat32(c.offset, true));
        case FLOAT64:
            return fixed(c, 8, () => c.view.getFloat64(c.offset, true));
        case UINT64:
        case INT64:
            return has(c, 8) ? { ok: true, num: readU64(c) } : { ok: false };
        case STRING: {
            const str = readString(c);
            return str === null ? { ok: false } : { ok: true, str };
        }
        case ARRAY: {
            if (!has(c, 12)) {
                return { ok: false };
            }
            const elementType = readU32(c);
            const length = readU64(c);
            const strs = new Array();
            for (let i = 0; i < length; i += 1) {
                const element = readValue(c, elementType);
                if (!element.ok) {
                    return { ok: false };
                }
                if (collect && element.str !== undefined) {
                    strs.push(element.str);
                }
            }
            return collect ? { ok: true, strs } : { ok: true };
        }
        default:
            return { ok: false };
    }
}
function fixed(c, width, read) {
    if (!has(c, width)) {
        return { ok: false };
    }
    const num = read();
    c.offset += width;
    return { ok: true, num };
}
function has(c, n) {
    return n >= 0 && c.offset + n <= c.bytes.byteLength;
}
function readU32(c) {
    const value = c.view.getUint32(c.offset, true);
    c.offset += 4;
    return value;
}
function readU64(c) {
    const lo = c.view.getUint32(c.offset, true);
    const hi = c.view.getUint32(c.offset + 4, true);
    c.offset += 8;
    return hi * 2 ** 32 + lo;
}
function readString(c) {
    if (!has(c, 8))
        return null;
    const length = readU64(c);
    if (!has(c, length)) {
        return null;
    }
    const str = b4a.toString(c.bytes.subarray(c.offset, c.offset + length), 'utf8');
    c.offset += length;
    return str;
}
