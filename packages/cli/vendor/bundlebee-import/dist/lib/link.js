"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLink = parseLink;
const pear_link_1 = require("pear-link");
const hypercore_id_encoding_1 = require("hypercore-id-encoding");
const bare_semver_1 = require("bare-semver");
const errors_1 = require("./errors");
function parseLink(link, options) {
    if (!link.startsWith('bundle+pear://'))
        throw invalid('Expected bundle+pear protocol');
    const rawPath = link.replace(/^[^:]+:\/\/[^/]+/, '').split(/[?#]/)[0];
    const parsed = (0, pear_link_1.parse)(link.slice(7));
    if (parsed.hash || parsed.drive.hash || parsed.drive.fork) {
        throw invalid('Unsupported hash or fork selector');
    }
    const query = new URLSearchParams(parsed.search);
    for (const [key] of query) {
        if (!['name', 'version', 'abi'].includes(key) || query.getAll(key).length !== 1) {
            throw invalid('Unknown or repeated selector: ' + key);
        }
    }
    const name = select(query, 'name', options.name);
    if (!name || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) {
        throw invalid('Package name required');
    }
    const abi = select(query, 'abi', options.abi?.toString());
    const version = select(query, 'version', options.version);
    if (abi !== null && version !== null)
        throw invalid('Choose version or ABI');
    const selector = abi === null ? { name, version: version ?? '*' } : { name, abi: Number(abi) };
    if (abi !== null && (!/^[1-9]\d*$/.test(abi) || !Number.isSafeInteger(Number(abi)))) {
        throw invalid('Invalid ABI');
    }
    if ('version' in selector && selector.version !== undefined)
        bare_semver_1.Range.parse(selector.version);
    const length = parsed.drive.length;
    if (length !== null &&
        (length < 1 ||
            !Number.isSafeInteger(length) ||
            !version ||
            !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version) ||
            bare_semver_1.Version.parse(version).toString() !== version ||
            abi !== null)) {
        throw invalid('Snapshot requires an exact version');
    }
    const entry = parsed.pathname && parsed.pathname !== '/' ? decodeURIComponent(parsed.pathname) : null;
    if (rawPath.split('/').some((part) => ['.', '..'].includes(decodeURIComponent(part))) ||
        entry?.includes('\\') ||
        entry?.includes('\0')) {
        throw invalid('Invalid entry assertion');
    }
    return { key: (0, hypercore_id_encoding_1.normalize)(parsed.drive.key), selector, length, entry };
}
function select(query, key, option) {
    const value = query.get(key);
    if (value !== null && option !== undefined && value !== option) {
        throw invalid('Conflicting release selector: ' + key);
    }
    return value ?? option ?? null;
}
function invalid(message) {
    return new errors_1.ImportError(message, { code: 'ERR_INVALID_RELEASE_LINK' });
}
