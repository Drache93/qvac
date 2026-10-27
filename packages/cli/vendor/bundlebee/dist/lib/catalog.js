"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishRelease = publishRelease;
exports.resolveRelease = resolveRelease;
exports.readRelease = readRelease;
const b4a_1 = __importDefault(require("b4a"));
const compact_encoding_1 = __importDefault(require("compact-encoding"));
const hypercore_id_encoding_1 = __importDefault(require("hypercore-id-encoding"));
const bare_semver_1 = __importDefault(require("bare-semver"));
const scope_lock_1 = __importDefault(require("scope-lock"));
const records = __importStar(require("./records"));
const errors_1 = require("./errors");
const requests_1 = require("./requests");
const MANIFEST = records.MANIFEST;
const pinFields = [
    'format',
    'name',
    'version',
    'entry',
    'abi'
];
const publishers = new Map();
async function publishRelease(tree, graph) {
    const key = hypercore_id_encoding_1.default.encode(tree.core.key);
    const publisher = publishers.get(key) ?? { lock: new scope_lock_1.default(), users: 0 };
    publishers.set(key, publisher);
    publisher.users++;
    await publisher.lock.lock();
    try {
        tree.update();
        return await commitRelease(tree, graph);
    }
    finally {
        publisher.lock.unlock();
        if (--publisher.users === 0)
            publishers.delete(key);
    }
}
async function commitRelease(tree, graph) {
    const { manifest, files, assets } = graph;
    const { name, version, abi, entry } = manifest;
    const versionKey = records.versionKey(name, version);
    const abiKey = records.abiKey(name, abi);
    if ((await tree.get(versionKey)) || (await tree.get(abiKey))) {
        throw new errors_1.ReleaseError('ERR_RELEASE_EXISTS', 'Version or ABI already published');
    }
    const snapshot = tree.write();
    try {
        for (const [path, value] of files) {
            snapshot.tryPut(records.moduleKey(path), compact_encoding_1.default.encode(records.Module, value));
        }
        for (const [path, bytes] of assets)
            snapshot.tryPut(records.assetKey(path), bytes);
        snapshot.tryPut(MANIFEST, compact_encoding_1.default.encode(records.Manifest, manifest));
        await snapshot.flush();
    }
    finally {
        await snapshot.close();
    }
    const head = tree.head();
    const pin = {
        format: 2,
        key: hypercore_id_encoding_1.default.encode(head.key),
        length: head.length,
        name,
        version,
        entry,
        abi
    };
    const index = tree.write();
    try {
        const encoded = compact_encoding_1.default.encode(records.Pin, pin);
        index.tryPut(versionKey, encoded);
        index.tryPut(abiKey, encoded);
        index.tryPut(records.orderedKey(name, version), encoded);
        await index.flush();
    }
    finally {
        await index.close();
    }
    return pin;
}
async function resolveRelease(bee, query) {
    const requests = new requests_1.Requests(bee.core, query);
    const tree = bee.snapshot({ wait: !query.offline });
    const config = requests.config;
    try {
        requests.check();
        if (query.abi !== undefined) {
            const record = await tree.get(records.abiKey(query.name, query.abi), config);
            requests.check();
            if (record)
                return indexedPin(bee, record, query, { ordered: false });
        }
        else {
            let exact = false;
            try {
                bare_semver_1.default.Version.parse(query.version);
                exact = true;
            }
            catch (error) {
                if (!(0, errors_1.hasCode)(error, 'INVALID_VERSION'))
                    throw error;
            }
            if (exact) {
                const record = await tree.get(records.versionKey(query.name, query.version), config);
                requests.check();
                if (record)
                    return indexedPin(bee, record, query, { ordered: false });
            }
            else {
                let range;
                try {
                    range = bare_semver_1.default.Range.parse(query.version);
                }
                catch (cause) {
                    throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Invalid semantic version range', cause);
                }
                const prefix = records.orderedPrefix(query.name);
                for await (const record of tree.createReadStream({
                    ...config,
                    gte: b4a_1.default.from(prefix),
                    lt: b4a_1.default.from(prefix + '\uffff'),
                    reverse: true
                })) {
                    requests.check();
                    const pin = indexedPin(bee, record, query, { ordered: true });
                    if (range.test(bare_semver_1.default.Version.parse(pin.version)))
                        return pin;
                }
            }
        }
        requests.check();
        throw new errors_1.ReleaseError('ERR_RELEASE_NOT_FOUND', 'No matching published release for ' + query.name);
    }
    catch (cause) {
        return requests.fail(cause);
    }
    finally {
        requests.close();
        await tree.close();
    }
}
function indexedPin(bee, record, query, options) {
    const { ordered } = options;
    const pin = records.validatePin(compact_encoding_1.default.decode(records.Pin, record.value));
    const expected = ordered
        ? records.orderedKey(query.name, pin.version)
        : query.abi === undefined
            ? records.versionKey(query.name, query.version)
            : records.abiKey(query.name, query.abi);
    if (pin.key !== hypercore_id_encoding_1.default.encode(bee.core.key) ||
        pin.name !== query.name ||
        !b4a_1.default.equals(record.key, expected) ||
        (!ordered && query.abi === undefined && pin.version !== query.version) ||
        (query.abi !== undefined && pin.abi !== query.abi)) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Release index disagrees with its publisher or selector');
    }
    return pin;
}
async function readRelease(bee, pin, options) {
    if (hypercore_id_encoding_1.default.encode(bee.core.key) !== pin.key) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Release key does not match this bundle');
    }
    const requests = new requests_1.Requests(bee.core, options);
    const tree = bee.checkout({ key: hypercore_id_encoding_1.default.decode(pin.key), length: pin.length, wait: !options.offline });
    const config = requests.config;
    try {
        requests.check();
        const record = await tree.get(MANIFEST, config);
        if (!record) {
            throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Pinned snapshot has no release manifest');
        }
        const manifest = compact_encoding_1.default.decode(records.Manifest, record.value);
        for (const field of pinFields) {
            if (manifest[field] !== pin[field]) {
                throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Pin disagrees with release manifest: ' + field);
            }
        }
        const files = new Map();
        for (const path of manifest.files) {
            records.releasePath(path);
            const value = await tree.get(records.moduleKey(path), config);
            if (!value)
                throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Missing release module: ' + path);
            const file = compact_encoding_1.default.decode(records.Module, value.value);
            files.set(path, {
                source: file.source,
                resolutions: records.parseResolutions(file.resolutions)
            });
        }
        const assets = new Map();
        for (const asset of manifest.assets) {
            records.releasePath(asset.path);
            const value = await tree.get(records.assetKey(asset.path), config);
            if (!value) {
                throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Missing release asset: ' + asset.path);
            }
            assets.set(asset.path, value.value);
        }
        if (!files.has(pin.entry)) {
            throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Release entry not present');
        }
        requests.check();
        return { manifest, files, assets };
    }
    catch (cause) {
        return requests.fail(cause);
    }
    finally {
        requests.close();
        await tree.close();
    }
}
