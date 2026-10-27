import path from 'path';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { ServerPool } from './pool.js';
import { createLspTool } from './tool.js';
const IDLE_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const START_WAIT_MS = 30_000;
function positive(value) {
    return value === undefined || (Number.isFinite(value) && value > 0);
}
function serverError(server, languages, claimed) {
    if (!server.language)
        return 'each server needs a language';
    const named = `server '${server.language}'`;
    if (languages.has(server.language)) {
        return `${named} is configured twice`;
    }
    languages.add(server.language);
    if (!path.isAbsolute(server.command ?? '')) {
        return `${named} needs an absolute command`;
    }
    if (!server.extensions?.length) {
        return `${named} needs extensions`;
    }
    const taken = server.extensions.find((ext) => !ext.startsWith('.') || claimed.has(ext));
    if (taken) {
        return `${named} extension '${taken}' needs a dot and one server`;
    }
    for (const ext of server.extensions) {
        claimed.add(ext);
    }
    return null;
}
export class LspPlugin {
    name = 'lsp';
    api = PluginRegistry.API_VERSION;
    addons = { 'bare-subprocess': () => import('bare-subprocess') };
    read;
    _options;
    constructor(options) {
        this._options = options;
        this.read = options?.read;
    }
    validate() {
        const config = this._options;
        if (!config?.servers?.length) {
            return 'config needs at least one server';
        }
        if (!positive(config.idleMs) || !positive(config.requestTimeoutMs)) {
            return 'idleMs and requestTimeoutMs must be positive';
        }
        const languages = new Set();
        const claimed = new Set();
        for (const server of config.servers) {
            const error = serverError(server, languages, claimed);
            if (error) {
                return error;
            }
        }
        return null;
    }
    setup(ctx) {
        const config = this._options;
        const pool = new ServerPool({
            idleMs: config.idleMs ?? IDLE_MS,
            startWaitMs: START_WAIT_MS,
            spawn: config.spawn
        });
        const tool = createLspTool({
            pool,
            servers: config.servers,
            requestTimeoutMs: config.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
            deniedRoots: [...new Set([...ctx.deniedRoots, ...(config.deniedRoots ?? [])])]
        });
        return { tools: [tool], teardown: () => pool.close() };
    }
}
