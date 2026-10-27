import b4a from 'b4a';
import { isRecord } from '../../guards.js';
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const PRINTABLE_RATIO = 0.9;
export function encodeDeclaredFields(body, encode) {
    if (!encode)
        return body;
    const parsed = asObject(body);
    if (!parsed) {
        return body;
    }
    let next = parsed;
    for (const [path, encoding] of Object.entries(encode)) {
        if (encoding !== 'base64' && encoding !== 'base64url')
            continue;
        next = setAt(next, path.split('.'), encoding);
    }
    return next;
}
function asObject(body) {
    if (typeof body === 'string') {
        try {
            return asObject(JSON.parse(body));
        }
        catch {
            return null;
        }
    }
    if (!isRecord(body) || Array.isArray(body)) {
        return null;
    }
    return body;
}
function setAt(body, path, encoding) {
    const [head, ...rest] = path;
    if (head === undefined) {
        return body;
    }
    const current = body[head];
    if (rest.length) {
        if (!isRecord(current)) {
            return body;
        }
        return { ...body, [head]: setAt(current, rest, encoding) };
    }
    if (typeof current !== 'string') {
        return body;
    }
    return { ...body, [head]: encodeValue(current, encoding) };
}
function encodeValue(value, encoding) {
    if (isAlreadyEncoded(value))
        return value;
    return b4a.toString(b4a.from(value, 'utf8'), encoding);
}
function isAlreadyEncoded(value) {
    if (!BASE64URL.test(value) && !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        return false;
    }
    try {
        const decoded = b4a.toString(b4a.from(value, 'base64'), 'utf8');
        return decoded.length > 0 && isMostlyPrintable(decoded);
    }
    catch {
        return false;
    }
}
function isMostlyPrintable(text) {
    const chars = [...text];
    const printable = chars.filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        if (code === 0xfffd) {
            return false;
        }
        return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    }).length;
    return printable / chars.length >= PRINTABLE_RATIO;
}
