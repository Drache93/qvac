"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectGraph = collectGraph;
const bare_url_1 = __importDefault(require("bare-url"));
const fs_1 = __importDefault(require("fs"));
const bare_module_traverse_1 = __importDefault(require("bare-module-traverse"));
const bare_1 = __importDefault(require("bare-module-traverse/resolve/bare"));
const url_file_url_1 = require("url-file-url");
const errors_1 = require("./errors");
const records_1 = require("./records");
const resolutions_1 = require("./resolutions");
const bare_buffer_1 = __importDefault(require("bare-buffer"));
async function collectGraph(root, entry, options) {
    const { name, version, abi } = options;
    root = new bare_url_1.default(root.href);
    if (!root.pathname.endsWith('/'))
        root = new bare_url_1.default('./', root);
    const realRoot = (0, url_file_url_1.pathToFileURL)(await fs_1.default.promises.realpath((0, url_file_url_1.fileURLToPath)(root))).href.replace(/\/$/, '') + '/';
    async function confined(url) {
        const actual = (0, url_file_url_1.pathToFileURL)(await fs_1.default.promises.realpath((0, url_file_url_1.fileURLToPath)(url))).href;
        if (actual !== realRoot.slice(0, -1) && !actual.startsWith(realRoot)) {
            throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Module or asset is outside publish root: ' + url.href);
        }
    }
    async function readScoped(url) {
        try {
            await confined(url);
        }
        catch (err) {
            if ((0, errors_1.hasCode)(err, 'ENOENT', 'ENOTDIR'))
                return null;
            throw err;
        }
        return read(url);
    }
    async function readAsset(url) {
        await confined(url);
        return bare_buffer_1.default.from(await fs_1.default.promises.readFile((0, url_file_url_1.fileURLToPath)(url)));
    }
    async function* listScoped(url) {
        try {
            await confined(url);
        }
        catch (err) {
            if ((0, errors_1.hasCode)(err, 'ENOENT', 'ENOTDIR'))
                return;
            throw err;
        }
        for await (const entry of list(url)) {
            await confined(entry);
            yield entry;
        }
    }
    const entryURL = new bare_url_1.default(entry, root);
    const entryPath = relative(root, entryURL);
    const hosts = Object.entries(options.hostRequirements ?? {}).map(([specifier, host]) => ({
        specifier,
        version: host.version,
        abi: host.abi ?? '',
        platform: host.platform ?? '',
        arch: host.arch ?? ''
    }));
    const hostNames = new Set(hosts.map((host) => host.specifier));
    const files = new Map();
    const assets = new Map();
    const metadata = new Map();
    for (const item of options.assets || []) {
        const asset = typeof item === 'string' ? { path: item } : item;
        const path = (0, records_1.releasePath)(asset.path.startsWith('/') ? asset.path : '/' + asset.path);
        const platform = asset.platform ?? '';
        const arch = asset.arch ?? '';
        metadata.set(path, { path, platform, arch });
        assets.set(path, await readAsset(new bare_url_1.default('.' + path, root)));
    }
    function* resolver(imported, parent, opts) {
        if (hostNames.has(imported.specifier)) {
            yield { resolution: new bare_url_1.default('builtin:' + imported.specifier) };
            return 1;
        }
        return yield* (0, bare_1.default)(imported, parent, opts);
    }
    const iterator = (0, bare_module_traverse_1.default)(entryURL, { resolve: resolver, hosts: options.platforms ? [...options.platforms] : undefined }, readScoped, listScoped)[Symbol.asyncIterator]();
    while (true) {
        const next = await iterator.next();
        if (next.done) {
            for (const url of [...(next.value?.assets || []), ...(next.value?.addons || [])]) {
                const path = relative(root, url);
                assets.set(path, await readAsset(url));
                if (!metadata.has(path))
                    metadata.set(path, { path, platform: '', arch: '' });
            }
            break;
        }
        const dependency = next.value;
        const path = relative(root, dependency.url);
        files.set(path, {
            source: typeof dependency.source === 'string' ? bare_buffer_1.default.from(dependency.source) : dependency.source,
            resolutions: JSON.stringify((0, resolutions_1.mapResolutions)(dependency.imports, (url) => url.startsWith('builtin:') ? url : relative(root, new bare_url_1.default(url))))
        });
    }
    const manifest = {
        format: 2,
        name,
        version,
        entry: entryPath,
        abi,
        files: [...files.keys()].sort(),
        assets: [...metadata.values()],
        hosts
    };
    if (!files.has(entryPath)) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Entry was not included in the module graph');
    }
    return { manifest, files, assets };
}
function relative(root, url) {
    if (url.protocol !== 'file:' || !url.href.startsWith(root.href)) {
        throw new errors_1.ReleaseError('ERR_INVALID_RELEASE', 'Module or asset is outside publish root: ' + url.href);
    }
    return (0, records_1.releasePath)('/' + decodeURIComponent(url.href.slice(root.href.length)));
}
async function read(url) {
    try {
        return bare_buffer_1.default.from(await fs_1.default.promises.readFile((0, url_file_url_1.fileURLToPath)(url)));
    }
    catch (err) {
        if ((0, errors_1.hasCode)(err, 'ENOENT', 'ENOTDIR'))
            return null;
        throw err;
    }
}
async function* list(url) {
    let stat;
    try {
        stat = await fs_1.default.promises.stat((0, url_file_url_1.fileURLToPath)(url));
    }
    catch (err) {
        if ((0, errors_1.hasCode)(err, 'ENOENT'))
            return;
        throw err;
    }
    if (stat.isFile()) {
        yield url;
        return;
    }
    const base = url.href.endsWith('/') ? url : new bare_url_1.default(url.href + '/');
    for (const entry of await fs_1.default.promises.readdir((0, url_file_url_1.fileURLToPath)(base), { withFileTypes: true })) {
        const child = new bare_url_1.default(encodeURIComponent(entry.name), base);
        if (entry.isDirectory())
            yield* list(child);
        else
            yield child;
    }
}
