"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bare_url_1 = __importDefault(require("bare-url"));
const bare_module_traverse_1 = __importDefault(require("bare-module-traverse"));
const bare_1 = __importDefault(require("bare-module-traverse/resolve/bare"));
const bare_bundle_1 = __importDefault(require("bare-bundle"));
const bare_module_1 = __importDefault(require("bare-module"));
const url_file_url_1 = require("url-file-url");
const fs_1 = __importDefault(require("fs"));
const b4a_1 = __importDefault(require("b4a"));
const ready_resource_1 = __importDefault(require("ready-resource"));
const hyperbee2_1 = __importDefault(require("hyperbee2"));
const compact_encoding_1 = __importDefault(require("compact-encoding"));
const schema_1 = require("./schema");
const records_1 = require("./lib/records");
const graph_1 = require("./lib/graph");
const catalog_1 = require("./lib/catalog");
const modules_1 = require("./lib/modules");
const requests_1 = require("./lib/requests");
const errors_1 = require("./lib/errors");
const bare_buffer_1 = __importDefault(require("bare-buffer"));
const Entry = (0, schema_1.getEncoding)('@bundlebee/entry');
const Manifest = (0, schema_1.getEncoding)('@bundlebee/manifest');
const PeerDeps = (0, schema_1.getEncoding)('@bundlebee/peer-deps');
const MANIFEST_KEY_VALUE = '#manifest';
const MANIFEST_KEY = bare_buffer_1.default.from(MANIFEST_KEY_VALUE);
const PEERDEPS_KEY_VALUE = '#peer-deps';
const PEERDEPS_KEY = bare_buffer_1.default.from(PEERDEPS_KEY_VALUE);
class Bundlebee extends ready_resource_1.default {
    offline;
    store;
    options;
    _bee;
    constructor(store, options = {}) {
        super();
        this.store = store;
        this.options = options;
        this.offline = options.offline ?? false;
        this._bee = null;
    }
    static validateRelease(pin) {
        return (0, records_1.validatePin)(pin);
    }
    async publish(rootURL, entry, options) {
        if (!this.opened)
            await this.ready();
        const graph = await (0, graph_1.collectGraph)(new bare_url_1.default(rootURL.href), entry, options);
        return (0, catalog_1.publishRelease)(this.tree, graph);
    }
    async resolve(query) {
        if (!this.opened)
            await this.ready();
        return (0, catalog_1.resolveRelease)(this.tree, { ...query, offline: query.offline ?? this.offline });
    }
    async prefetch(pin, options = {}) {
        if (!this.opened)
            await this.ready();
        await (0, catalog_1.readRelease)(this.tree, pin, { ...options, offline: options.offline ?? this.offline });
        return pin;
    }
    async loadRelease(pin, options = {}) {
        if (!this.opened)
            await this.ready();
        const contents = await (0, catalog_1.readRelease)(this.tree, pin, {
            ...options,
            offline: options.offline ?? this.offline
        });
        return (0, modules_1.loadModules)(pin, contents, options);
    }
    async update(options = {}) {
        if (!this.opened)
            await this.ready();
        const requests = new requests_1.Requests(this.core, options);
        try {
            requests.check();
            const updated = await this.core.update(requests.config);
            requests.check();
            return updated;
        }
        catch (cause) {
            return requests.fail(cause);
        }
        finally {
            requests.close();
        }
    }
    get tree() {
        if (this.closing)
            throw new errors_1.ReleaseError('ERR_RESOURCE_CLOSED', 'Bundle is closing');
        return this._bee;
    }
    static async require(store, ...inputs) {
        const options = [...inputs]
            .reverse()
            .find((input) => typeof input === 'object' && !('bundle' in input)) ?? {};
        const bee = new Bundlebee(store, options);
        const manifest = await bee.manifest();
        for (const input of inputs) {
            if (typeof input !== 'string' && !('bundle' in input))
                continue;
            const data = typeof input === 'string' ? { bundle: input, abi: 0 } : input;
            if (options.skipExistingABIs && manifest && (data.abi ?? 0) <= manifest.abi)
                continue;
            const bundle = typeof data.bundle === 'string' ? Bundlebee.bundleFrom(data.bundle) : data.bundle;
            await bee._addBundle({ bundle, abi: data.abi }, options);
        }
        return bee;
    }
    static bundleFrom(f) {
        if (f.endsWith('.js')) {
            const loadBundle = require;
            return loadBundle(f);
        }
        return bare_bundle_1.default.from(bare_buffer_1.default.from(fs_1.default.readFileSync(f)));
    }
    get core() {
        return this.tree.core;
    }
    head() {
        return this.tree.head();
    }
    get key() {
        return this.tree.core.key;
    }
    get discoveryKey() {
        return this.tree.core.discoveryKey;
    }
    async _open() {
        const { key, length = -1 } = this.options;
        this._bee = new hyperbee2_1.default(this.store, {
            ...this.options,
            autoUpdate: this.offline ? false : (this.options.autoUpdate ?? (!key || length === -1)),
            wait: this.offline ? false : this.options.wait
        });
        try {
            await this._bee.ready();
            if (this.closing)
                return;
            if (key && length !== -1)
                await this._bee.move({ key, length });
        }
        catch (error) {
            await this._bee.close();
            throw error;
        }
    }
    async _close() {
        if (this._bee)
            await this._bee.close();
        else
            await this.store.close();
    }
    async *createEntryStream(checkout) {
        if (!this.opened)
            await this.ready();
        const b = checkout ? await this.checkout(checkout) : this.tree;
        try {
            for await (const data of b.createReadStream()) {
                const id = data.key.toString();
                if (id.startsWith('#'))
                    continue;
                const entry = compact_encoding_1.default.decode(Entry, data.value);
                yield { ...entry, id };
            }
        }
        finally {
            if (checkout)
                await b.close();
        }
    }
    async manifest(checkout) {
        if (!this.opened)
            await this.ready();
        const b = checkout ? await this.checkout(checkout) : this.tree;
        try {
            const entry = await b.get(MANIFEST_KEY);
            if (!entry)
                return null;
            return compact_encoding_1.default.decode(Manifest, entry.value);
        }
        finally {
            if (checkout)
                await b.close();
        }
    }
    async peerDependencies(checkout) {
        if (!this.opened)
            await this.ready();
        const b = checkout ? await this.checkout(checkout) : this.tree;
        try {
            const entry = await b.get(bare_buffer_1.default.from('#peer-deps'));
            if (!entry)
                return null;
            const { packages } = compact_encoding_1.default.decode(PeerDeps, entry.value);
            return new Set(packages);
        }
        finally {
            if (checkout)
                await b.close();
        }
    }
    async get(key, checkout) {
        if (!this.opened)
            await this.ready();
        const b = checkout ? await this.checkout(checkout) : this.tree;
        try {
            const entry = await b.get(bare_buffer_1.default.from(key));
            if (!entry)
                return null;
            return compact_encoding_1.default.decode(Entry, entry.value);
        }
        finally {
            if (checkout)
                await b.close();
        }
    }
    async findABI(abi) {
        if (!this.opened)
            await this.ready();
        for await (const d of this.tree.createChangesStream()) {
            let record = null;
            for (const b of d.batch) {
                if (!b.keys)
                    continue;
                const r = b.keys.find((k) => k.key.toString() === MANIFEST_KEY_VALUE);
                if (!r)
                    continue;
                record = r;
            }
            if (!record)
                continue;
            const manifest = compact_encoding_1.default.decode(Manifest, record.value);
            if (manifest.abi !== abi)
                continue;
            return d.head;
        }
        return null;
    }
    async *allABIs() {
        if (!this.opened)
            await this.ready();
        for await (const d of this.tree.createChangesStream()) {
            let record = null;
            for (const b of d.batch) {
                if (!b.keys)
                    continue;
                const r = b.keys.find((k) => k.key.toString() === MANIFEST_KEY_VALUE);
                if (!r)
                    continue;
                record = r;
            }
            if (!record)
                continue;
            const manifest = compact_encoding_1.default.decode(Manifest, record.value);
            yield { checkout: d.head, manifest };
        }
    }
    async checkout(checkout) {
        if (!this.opened)
            await this.ready();
        return this.tree.checkout(checkout);
    }
    async load(rootURL, entry, checkout, { cache = require.cache, skipModules = true, map } = {}) {
        const root = new bare_url_1.default(rootURL.href);
        if (!this.opened)
            await this.ready();
        if (!(await this.get(entry, checkout)))
            throw new Error(`${entry} not found`);
        const b = await this.checkout(checkout);
        try {
            const loadedData = new Map();
            const protocol = new bare_module_1.default.Protocol({
                exists(url) {
                    return true;
                },
                read(url) {
                    const p = url.pathname;
                    const loaded = loadedData.get(p);
                    if (map)
                        return map(p, loaded);
                    return loaded ?? null;
                }
            });
            const bundleCache = Object.create(null);
            const builtins = Object.create(null);
            const allResolutions = {};
            const peerDeps = await this.peerDependencies(checkout);
            for await (const data of b.createReadStream()) {
                const id = data.key.toString();
                if (id.startsWith('#'))
                    continue;
                const { resolutions, source } = compact_encoding_1.default.decode(Entry, data.value);
                loadedData.set(id, source);
                const m = {};
                for (const [k, v] of Object.entries(resolutions)) {
                    const skip = peerDeps && peerDeps.has(k);
                    const nm = (v.includes('node_modules/') && skipModules) || skip ? findModule(cache, v, root) : null;
                    if (nm) {
                        m[k] = 'builtin:bundlebee-host-' + Object.keys(builtins).length;
                        builtins[m[k].slice(8)] = nm.exports;
                    }
                    else {
                        m[k] = 'bundle://layer' + v;
                    }
                }
                allResolutions['bundle://layer' + id] = m;
            }
            return await bare_module_1.default.load(new bare_url_1.default(entry, 'bundle://layer/'), {
                protocol,
                resolutions: allResolutions,
                builtins,
                cache: bundleCache
            });
        }
        finally {
            await b.close();
        }
    }
    async add(rootURL, entry, { skipModules = true, peerDependencies, abi, dryRun = false, source, pre } = {}) {
        let root = new bare_url_1.default(rootURL.href);
        if (!this.opened)
            await this.ready();
        if (!root.pathname.endsWith('/'))
            root = new bare_url_1.default('./', root);
        const peers = peerDependencies ? new Set(peerDependencies) : null;
        const bundle = new bare_bundle_1.default();
        const resolutions = {};
        const entryURL = new bare_url_1.default(entry, root);
        const read = source
            ? async function (url) {
                if (url.href === entryURL.href) {
                    return typeof source === 'string' ? bare_buffer_1.default.from(source) : source;
                }
                return readModule(url);
            }
            : readModule;
        for await (const dependency of (0, bare_module_traverse_1.default)(entryURL, { resolve: bare_1.default }, read, listPrefix)) {
            if (dependency.url.href.includes('/node_modules/')) {
                if (skipModules)
                    continue;
                if (peers) {
                    const moduleName = dependency.url.pathname
                        .slice(dependency.url.pathname.lastIndexOf('node_modules/') + 13)
                        .split('/')[0];
                    if (peers.has(moduleName))
                        continue;
                }
            }
            const p = dependency.url.pathname.replace(root.pathname, '/');
            const imps = {};
            for (const [k, v] of Object.entries(flatImports(dependency.imports))) {
                imps[k] = new bare_url_1.default(v).pathname.replace(root.pathname, '/');
            }
            const existing = await this.get(p);
            if (existing &&
                b4a_1.default.equals(existing.source, typeof dependency.source === 'string' ? bare_buffer_1.default.from(dependency.source) : dependency.source) &&
                sameImports(existing.resolutions, imps)) {
                continue;
            }
            // @ts-expect-error bare-bundle 1.11 accepts Buffer bytes; its declaration only lists string.
            bundle.write(p, dependency.source);
            resolutions[p] = imps;
        }
        bundle.resolutions = resolutions;
        if (dryRun)
            return bundle;
        await this._addBundle({ bundle, abi }, { pre, peerDependencies });
        return bundle;
    }
    async _addBundle(data, { peerDependencies, pre } = {}) {
        if (!this.opened)
            await this.ready();
        let nextAbi = data.abi;
        const previousManifest = await this.manifest();
        if (nextAbi && previousManifest && nextAbi <= previousManifest.abi) {
            throw new Error(`ABI ${nextAbi} <= to current ABI ${previousManifest.abi}`);
        }
        else if (!nextAbi) {
            nextAbi = previousManifest ? previousManifest.abi + 1 : 1;
        }
        const w = this.tree.write();
        try {
            for (const f in data.bundle.files) {
                const source = data.bundle.files[f].read();
                w.tryPut(bare_buffer_1.default.from(f), compact_encoding_1.default.encode(Entry, {
                    source: pre ? await pre(source, f) : source,
                    resolutions: flatImports(data.bundle.resolutions[f])
                }));
            }
            if (peerDependencies) {
                w.tryPut(bare_buffer_1.default.from(PEERDEPS_KEY), compact_encoding_1.default.encode(PeerDeps, {
                    packages: [...peerDependencies]
                }));
            }
            w.tryPut(bare_buffer_1.default.from(MANIFEST_KEY), compact_encoding_1.default.encode(Manifest, {
                abi: nextAbi
            }));
            await w.flush();
        }
        finally {
            await w.close();
        }
    }
}
exports.default = Bundlebee;
function sameImports(a, b) {
    const x = Object.keys(a);
    const y = Object.keys(b);
    if (x.length !== y.length)
        return false;
    for (let i = 0; i < x.length; i++) {
        if (a[x[i]] !== b[x[i]])
            return false;
    }
    return true;
}
async function readModule(url) {
    return new Promise((resolve) => {
        fs_1.default.readFile((0, url_file_url_1.fileURLToPath)(url), (err, data) => {
            resolve(err ? null : bare_buffer_1.default.from(data));
        });
    });
}
async function openDir(url) {
    return new Promise((resolve, reject) => {
        fs_1.default.opendir((0, url_file_url_1.fileURLToPath)(url), (err, dir) => {
            err ? reject(err) : resolve(dir);
        });
    });
}
async function isFile(url) {
    return new Promise((resolve) => {
        fs_1.default.stat((0, url_file_url_1.fileURLToPath)(url), (err, stat) => {
            resolve(err === null && stat.isFile());
        });
    });
}
async function isDir(url) {
    return new Promise((resolve) => {
        fs_1.default.stat((0, url_file_url_1.fileURLToPath)(url), (err, stat) => {
            resolve(err === null && stat.isDirectory());
        });
    });
}
async function* listPrefix(url) {
    if (await isFile(url))
        return yield url;
    if (url.pathname[url.pathname.length - 1] !== '/') {
        url.pathname += '/';
    }
    if (await isDir(url)) {
        for await (const entry of await openDir(url)) {
            if (entry.isDirectory()) {
                yield* listPrefix(new bare_url_1.default(entry.name, url));
            }
            else {
                yield new bare_url_1.default(entry.name, url);
            }
        }
    }
}
function findModule(cache, v, root) {
    let s = '.';
    let prev = null;
    while (true) {
        const cand = new bare_url_1.default(s + v, root).href;
        s += '/..';
        if (prev === cand)
            break;
        prev = cand;
        const nm = cache[cand];
        if (nm)
            return nm;
    }
    throw new Error(`failed to find module: ${v}`);
}
function flatImports(imports) {
    const result = {};
    for (const [key, value] of Object.entries(imports)) {
        if (typeof value === 'string')
            result[key] = value;
    }
    return result;
}
