"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadModules = loadModules;
const bare_url_1 = __importDefault(require("bare-url"));
const bare_module_1 = __importDefault(require("bare-module"));
const assets_1 = require("./assets");
const hosts_1 = require("./hosts");
const records_1 = require("./records");
const resolutions_1 = require("./resolutions");
const errors_1 = require("./errors");
async function loadModules(pin, contents, options) {
    const { manifest, files, assets } = contents;
    const target = options.platform ?? { platform: Bare.platform, arch: Bare.arch };
    const builtins = (0, hosts_1.hostModules)(manifest.hosts, options.hostProviders ?? {});
    const selected = new Map();
    for (const asset of manifest.assets) {
        if ((!asset.platform || asset.platform === target.platform) &&
            (!asset.arch || asset.arch === target.arch)) {
            selected.set(asset.path, assets.get(asset.path));
        }
    }
    const assetURLs = await (0, assets_1.materialize)(pin, selected, {
        directory: options.assetDirectory,
        target,
        signal: options.signal
    });
    const origin = 'bundle://' + pin.key + '-' + pin.length;
    const href = (path) => new bare_url_1.default(path, origin).href;
    const resolutions = {};
    const sources = new Map();
    for (const [path, file] of files) {
        if (!assets.has(path) || selected.has(path))
            sources.set(href(path), file.source);
        resolutions[href(path)] = (0, resolutions_1.mapResolutions)(file.resolutions, (path) => {
            if (path.startsWith('builtin:')) {
                if (!Object.hasOwn(builtins, path.slice(8))) {
                    throw new errors_1.ReleaseError('ERR_HOST_INCOMPATIBLE', 'Undeclared host module');
                }
                return path;
            }
            (0, records_1.releasePath)(path);
            if (assets.has(path) && !selected.has(path))
                return undefined;
            return assetURLs.get(path)?.href || href(path);
        });
    }
    const cachedAssets = new Map([...assetURLs].map(([path, url]) => [url.href, selected.get(path)]));
    const protocol = new bare_module_1.default.Protocol({
        exists(url) {
            return (sources.has(url.href) ||
                cachedAssets.has(url.href) ||
                assetURLs.has(decodeURIComponent(url.pathname)));
        },
        read(url) {
            return (sources.get(url.href) ||
                cachedAssets.get(url.href) ||
                selected.get(decodeURIComponent(url.pathname)) ||
                null);
        },
        resolve(url) {
            const path = decodeURIComponent(url.pathname);
            if (assets.has(path) && !selected.has(path)) {
                throw new errors_1.ReleaseError('ERR_ASSET_UNAVAILABLE', 'Asset is unavailable for this platform: ' + path);
            }
            return assetURLs.get(path) || url;
        }
    });
    if (options.signal?.aborted) {
        throw options.signal.reason ?? new errors_1.ReleaseError('ABORT_ERR', 'Release operation aborted');
    }
    return bare_module_1.default.load(new bare_url_1.default(pin.entry, origin), {
        protocol,
        resolutions,
        builtins,
        cache: Object.create(null)
    });
}
