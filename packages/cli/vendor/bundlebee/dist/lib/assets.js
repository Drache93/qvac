"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.materialize = materialize;
const bare_url_1 = __importDefault(require("bare-url"));
const fs_1 = __importDefault(require("fs"));
const url_file_url_1 = require("url-file-url");
const b4a_1 = __importDefault(require("b4a"));
const hypercore_crypto_1 = __importDefault(require("hypercore-crypto"));
const errors_1 = require("./errors");
async function materialize(pin, assets, options) {
    const { directory, target, signal } = options;
    const urls = new Map();
    if (assets.size === 0)
        return urls;
    if (!directory) {
        throw new errors_1.ReleaseError('ERR_ASSET_DIRECTORY_REQUIRED', 'An assetDirectory is required for release assets');
    }
    const rootPath = typeof directory === 'object' && directory !== null
        ? (0, url_file_url_1.fileURLToPath)(new bare_url_1.default(directory.href))
        : directory;
    await fs_1.default.promises.mkdir(rootPath, { recursive: true });
    const realRoot = await fs_1.default.promises.realpath(rootPath);
    const root = (0, url_file_url_1.pathToFileURL)(realRoot + '/');
    const folder = `${pin.key}-${pin.length}-${target.platform}-${target.arch}/`;
    const base = new bare_url_1.default(folder, root);
    await ensureDirectory(base, root);
    for (const [path, bytes] of assets) {
        if (signal?.aborted) {
            throw signal.reason ?? new errors_1.ReleaseError('ABORT_ERR', 'Release operation aborted');
        }
        const url = new bare_url_1.default('.' + path, base);
        await ensureDirectory(new bare_url_1.default('./', url), root);
        const filename = (0, url_file_url_1.fileURLToPath)(url);
        try {
            const stat = await fs_1.default.promises.lstat(filename);
            if (!stat.isFile() || stat.isSymbolicLink()) {
                throw new errors_1.ReleaseError('ERR_ASSET_PATH', 'Asset cache path is not a regular file');
            }
            const existing = await fs_1.default.promises.readFile(filename);
            if (b4a_1.default.equals(existing, bytes)) {
                urls.set(path, url);
                continue;
            }
        }
        catch (err) {
            if (!(0, errors_1.hasCode)(err, 'ENOENT'))
                throw err;
        }
        const temporary = filename + '.' + b4a_1.default.toString(hypercore_crypto_1.default.randomBytes(16), 'hex') + '.tmp';
        try {
            await fs_1.default.promises.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
            await fs_1.default.promises.rename(temporary, filename);
        }
        finally {
            await fs_1.default.promises.unlink(temporary).catch((err) => {
                if (!(0, errors_1.hasCode)(err, 'ENOENT'))
                    throw err;
            });
        }
        urls.set(path, url);
    }
    return urls;
}
async function ensureDirectory(url, root) {
    if (!url.href.startsWith(root.href)) {
        throw new errors_1.ReleaseError('ERR_ASSET_PATH', 'Asset path escapes cache directory');
    }
    let current = root;
    for (const segment of url.href.slice(root.href.length).split('/').filter(Boolean)) {
        current = new bare_url_1.default(segment + '/', current);
        const filename = (0, url_file_url_1.fileURLToPath)(current).replace(/[\\/]$/, '');
        try {
            await fs_1.default.promises.mkdir(filename);
        }
        catch (err) {
            if (!(0, errors_1.hasCode)(err, 'EEXIST'))
                throw err;
        }
        const stat = await fs_1.default.promises.lstat(filename);
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
            throw new errors_1.ReleaseError('ERR_ASSET_PATH', 'Asset cache contains a symlink or non-directory');
        }
    }
}
