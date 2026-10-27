"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANIFEST = exports.Module = exports.Manifest = exports.Pin = void 0;
exports.moduleKey = moduleKey;
exports.assetKey = assetKey;
exports.versionKey = versionKey;
exports.abiKey = abiKey;
exports.orderedPrefix = orderedPrefix;
exports.orderedKey = orderedKey;
exports.releasePath = releasePath;
exports.validatePin = validatePin;
exports.parseResolutions = parseResolutions;
const hypercore_id_encoding_1 = __importDefault(require("hypercore-id-encoding"));
const bare_semver_1 = __importDefault(require("bare-semver"));
const schema_1 = require("../schema");
const errors_1 = require("./errors");
const b4a_1 = __importDefault(require("b4a"));
exports.Pin = (0, schema_1.getEncoding)('@bundlebee/release-pin');
exports.Manifest = (0, schema_1.getEncoding)('@bundlebee/release-manifest');
exports.Module = (0, schema_1.getEncoding)('@bundlebee/release-module');
exports.MANIFEST = b4a_1.default.from('#v2/release');
function moduleKey(path) {
    return b4a_1.default.from('#v2/module' + path);
}
function assetKey(path) {
    return b4a_1.default.from('#v2/asset' + path);
}
function versionKey(name, value) {
    return b4a_1.default.from(prefix(name) + 'exact/' + value);
}
function abiKey(name, abi) {
    return b4a_1.default.from(prefix(name) + 'abi/' + number(abi));
}
function orderedPrefix(name) {
    return prefix(name) + 'ordered/';
}
function orderedKey(name, input) {
    const v = bare_semver_1.default.Version.parse(input);
    const pre = v.prerelease.length
        ? '0' +
            v.prerelease
                .map((p) => (/^[0-9]+$/.test(p) ? '0' + number(p.length) + p : '1' + p))
                .join('\0') +
            '\0'
        : '1';
    return b4a_1.default.from(orderedPrefix(name) +
        [v.major, v.minor, v.patch].map(number).join('.') +
        '/' +
        pre +
        '\0' +
        input);
}
function releasePath(input) {
    if (!input.startsWith('/') ||
        input.includes('\\') ||
        /[\0-\x1f%?#:]/.test(input) ||
        input
            .split('/')
            .slice(1)
            .some((s) => !s || s === '.' || s === '..')) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid release path: ' + input);
    }
    return input;
}
function validatePin(input) {
    if (!input ||
        typeof input !== 'object' ||
        !('format' in input) ||
        input.format !== 2 ||
        !('key' in input) ||
        typeof input.key !== 'string' ||
        !('length' in input) ||
        typeof input.length !== 'number' ||
        !('abi' in input) ||
        typeof input.abi !== 'number' ||
        !('name' in input) ||
        typeof input.name !== 'string' ||
        !('version' in input) ||
        typeof input.version !== 'string' ||
        !('entry' in input) ||
        typeof input.entry !== 'string') {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Expected a format 2 release pin');
    }
    const { length, abi, name, version, entry } = input;
    if (!Number.isSafeInteger(length) ||
        length < 1 ||
        !Number.isSafeInteger(abi) ||
        abi < 1 ||
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid release identity or snapshot');
    }
    releasePath(entry);
    return {
        format: 2,
        key: canonicalKey(input.key),
        length,
        abi,
        name,
        version: canonicalVersion(version),
        entry
    };
}
function parseResolutions(json) {
    const value = JSON.parse(json);
    return resolutionObject(value);
}
function resolutionObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid module resolution map');
    }
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        Object.defineProperty(result, key, {
            value: resolution(child),
            enumerable: true
        });
    }
    return result;
}
function resolution(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return value.map(resolution);
    return resolutionObject(value);
}
function canonicalKey(key) {
    try {
        return hypercore_id_encoding_1.default.encode(hypercore_id_encoding_1.default.decode(key));
    }
    catch (cause) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid release key', cause);
    }
}
function canonicalVersion(version) {
    try {
        const parsed = bare_semver_1.default.Version.parse(version);
        if (parsed.toString() !== version ||
            [parsed.major, parsed.minor, parsed.patch].some((n) => !Number.isSafeInteger(n) || n < 0)) {
            throw new Error('Noncanonical version');
        }
        return version;
    }
    catch (cause) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid exact semantic version: ' + version, cause);
    }
}
function number(n) {
    return n.toString(16).padStart(14, '0');
}
function prefix(name) {
    return '#v2/package/' + encodeURIComponent(name) + '/';
}
