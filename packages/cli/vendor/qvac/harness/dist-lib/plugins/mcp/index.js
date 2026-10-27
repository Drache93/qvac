import { HarnessLog } from '../../lib/log.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { Tools } from '../../lib/tools/index.js';
import { credentialAllowListFor, mcpReadMethods } from '../../lib/tools/skills/index.js';
import { createMcpCallTool } from './call.js';
import { listServerTools, serverTool } from './server.js';
const SETUP_TIMEOUT_MS = 10_000;
const SERVER_NAME = /^[a-z0-9_-]+$/;
function serverError(server, names) {
    const named = `server '${server.name}'`;
    if (!SERVER_NAME.test(server.name ?? '') || server.name.includes('__')) {
        return `${named} needs a name of lowercase letters, digits, _ and -, without __`;
    }
    if (names.has(server.name)) {
        return `${named} is configured twice`;
    }
    names.add(server.name);
    let url;
    try {
        url = new URL(server.url);
    }
    catch {
        return `${named} needs a URL`;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return `${named} needs an http or https URL`;
    }
    return null;
}
export class McpPlugin {
    name = 'mcp';
    api = PluginRegistry.API_VERSION;
    read;
    _options;
    constructor(options) {
        this._options = options;
        this.read = options?.read;
    }
    validate() {
        const { servers = [], generic } = this._options ?? {};
        if (!servers.length && !generic) {
            return 'config needs servers or generic';
        }
        const names = new Set();
        for (const server of servers) {
            const error = serverError(server, names);
            if (error) {
                return error;
            }
        }
        return null;
    }
    async setup({ fetch }) {
        const { servers = [], generic, skillCatalog, credentialStore } = this._options;
        const tools = [];
        if (generic) {
            const mcpCallTool = createMcpCallTool({
                credentialStore: skillCatalog ? credentialStore : undefined,
                credentialAllowList: skillCatalog ? credentialAllowListFor(skillCatalog) : undefined,
                readMethods: skillCatalog ? mcpReadMethods(skillCatalog) : undefined
            });
            tools.push(mcpCallTool, ...Tools.operations(skillCatalog ?? [], { mcpCallTool }));
        }
        const timeoutMs = this._options.setupTimeoutMs ?? SETUP_TIMEOUT_MS;
        const listed = await Promise.allSettled(servers.map((server) => listServerTools(server, { fetch, credentialStore, timeoutMs })));
        const names = new Set(tools.map((tool) => tool.name));
        servers.forEach((server, index) => {
            const outcome = listed[index];
            if (outcome.status === 'rejected') {
                HarnessLog.info('mcp server unavailable', {
                    server: server.name,
                    error: String(outcome.reason)
                });
                return;
            }
            for (const entry of outcome.value) {
                const tool = serverTool(server, entry, credentialStore);
                if (names.has(tool.name)) {
                    HarnessLog.info('mcp tool listed twice', { tool: tool.name });
                    continue;
                }
                names.add(tool.name);
                tools.push(tool);
            }
        });
        return { tools };
    }
}
