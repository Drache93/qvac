import { grounded } from 'asenion';
import { decodeBase64, printableRatio, strings } from 'asenion/guards';
import { READ_METHODS } from './http-methods.js';
const ADDRESS = /[^\s<>,;:"'\\]{1,64}@[^\s<>,;:"'\\]{1,255}\.[A-Za-z]{2,24}/g;
const PRINTABLE_RATIO = 0.9;
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const RESERVED_TLDS = ['example', 'invalid', 'test', 'localhost'];
const OUTBOUND_TOOLS = new Set(['http_request', 'mcp_call']);
const MCP_READ_METHOD = /^(tools\/list|resources\/\w+|(get|list|search|read|find|fetch)[_.-])/i;
const HINT_LIMIT = 5;
export const REFUSAL = 'Refusing to send:';
export function trustedSourceFacts(origin, text) {
    const addresses = text.includes('@') ? unique(text.match(ADDRESS) ?? []) : [];
    return {
        origin,
        addresses,
        refused: text.includes(REFUSAL)
    };
}
export function guardToolCall(toolName, args, options) {
    return guardToolCallWithFacts(toolName, args, options);
}
export function guardToolCallWithFacts(toolName, args, { sources, sourceFacts = [], externalWrite = false }) {
    if (!externalWrite && !isOutbound(toolName, args))
        return null;
    const addresses = unique(scanPayload(args));
    if (!addresses.length) {
        return null;
    }
    const reserved = addresses.find((value) => isReserved(key(value)));
    if (reserved) {
        return `${REFUSAL} ${mask(reserved)} is a reserved documentation domain (RFC 2606) that cannot receive mail — a placeholder copied from an example, not a real address. Ask the user for the actual address.`;
    }
    const trusted = addressesIn(sources, sourceFacts, (origin) => origin !== 'skill');
    const unverified = addresses.filter((value) => !grounded(value, trusted).ok);
    if (!unverified.length) {
        return null;
    }
    if (alreadyRefusedThisTurn(sources, sourceFacts)) {
        return `${REFUSAL} ${masked(unverified)} still cannot be verified, and an earlier call in this turn was already refused for the same reason. Stop calling this tool. Reply to the user in plain text and ask them for the address.`;
    }
    const fromSkill = addressesIn(sources, sourceFacts, (origin) => origin === 'skill');
    const placeholders = unverified.filter((value) => grounded(value, fromSkill).ok);
    if (placeholders.length) {
        return `${REFUSAL} ${masked(placeholders)} appears only in the skill's own documentation — an example placeholder, not a real address. Ask the user for the actual address.`;
    }
    const spoofed = unverified.filter((value) => lookalikeOf(value, trusted) !== undefined);
    if (spoofed.length) {
        return drawnLike(spoofed, trusted);
    }
    return invented(unverified, trusted);
}
export const outboundGuard = {
    facts: trustedSourceFacts,
    check: guardToolCallWithFacts
};
function lookalikeOf(value, trusted) {
    return grounded(value, trusted).failures[0]?.looksLike;
}
function drawnLike(spoofed, trusted) {
    const drawn = spoofed.map((value) => `${mask(value)} is drawn like ${lookalikeOf(value, trusted)}`);
    return `${REFUSAL} ${drawn.join('; ')}. A character that only looks like another makes a different address, so this is not the one it resembles — ask the user which they meant instead of retrying.`;
}
function invented(unverified, trusted) {
    const base = `${REFUSAL} ${masked(unverified)} does not appear anywhere in this conversation or in any tool result, so it cannot be verified. Do not guess an address.`;
    if (!trusted.length) {
        return `${base} Look it up first with this skill's search endpoint, or ask the user for it instead of retrying.`;
    }
    return `${base} Addresses that do appear: ${trusted.slice(0, HINT_LIMIT).join(', ')}. Use one of those if it is the intended target; otherwise ask the user instead of retrying.`;
}
function alreadyRefusedThisTurn(sources, sourceFacts) {
    let turnStart = 0;
    for (const [index, source] of sources.entries()) {
        if (source.origin === 'user') {
            turnStart = index + 1;
        }
    }
    return (sources
        .slice(turnStart)
        .some((source) => source.origin === 'tool-result' && source.text.includes(REFUSAL)) ||
        sourceFacts.some((source) => source.origin === 'tool-result' && source.refused));
}
function isOutbound(toolName, args) {
    if (!OUTBOUND_TOOLS.has(toolName))
        return false;
    const method = typeof args.method === 'string' ? args.method : undefined;
    if (toolName !== 'http_request') {
        return !MCP_READ_METHOD.test(method ?? '');
    }
    return !READ_METHODS.has((method ?? 'GET').toUpperCase());
}
const IDENTIFIER_HEADER = /^\s*(message-id|in-reply-to|references)\s*:/i;
const IDENTIFIER_FIELD = /^(message[-_]?id|in[-_]?reply[-_]?to|references)$/i;
function addressesOutsideIdentifierHeaders(text) {
    return text
        .split(/\r?\n/)
        .filter((line) => !IDENTIFIER_HEADER.test(line))
        .flatMap((line) => line.match(ADDRESS) ?? []);
}
function scanPayload(payload) {
    const found = [];
    for (const value of strings(payload, { skip: (name) => IDENTIFIER_FIELD.test(name) })) {
        found.push(...addressesOutsideIdentifierHeaders(value));
        const hidden = decodeEncoded(value);
        if (hidden !== null && printableRatio(hidden) >= PRINTABLE_RATIO) {
            found.push(...addressesOutsideIdentifierHeaders(hidden));
        }
    }
    return found;
}
function decodeEncoded(value) {
    try {
        return decodeBase64(value);
    }
    catch {
        return null;
    }
}
function addressesIn(sources, sourceFacts, accept) {
    const found = [];
    for (const source of sources) {
        if (!accept(source.origin))
            continue;
        found.push(...(source.text.match(ADDRESS) ?? []));
    }
    for (const source of sourceFacts) {
        if (!accept(source.origin))
            continue;
        found.push(...source.addresses);
    }
    return unique(found);
}
function unique(values) {
    const seen = new Map();
    for (const value of values) {
        if (!seen.has(key(value))) {
            seen.set(key(value), value.trim());
        }
    }
    return [...seen.values()];
}
function key(value) {
    return value.trim().replace(/[A-Z]/g, (upper) => upper.toLowerCase());
}
function isReserved(address) {
    const domain = address.slice(address.lastIndexOf('@') + 1);
    return RESERVED_DOMAINS.has(domain) || RESERVED_TLDS.some((tld) => domain.endsWith(`.${tld}`));
}
function mask(value) {
    return value.replaceAll('@', ' [at] ');
}
function masked(values) {
    return values.map(mask).join(', ');
}
