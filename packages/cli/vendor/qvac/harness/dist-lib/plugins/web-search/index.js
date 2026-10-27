import { PluginRegistry } from '../../lib/plugins/index.js';
import { ENGINES } from './engine-registry.js';
import { createWebSearchTool } from './tool.js';
export class WebSearchPlugin {
    name = 'web-search';
    api = PluginRegistry.API_VERSION;
    read;
    engines;
    maxResults;
    constructor({ engines = ENGINES.map((engine) => engine.name), maxResults, read } = {}) {
        this.engines = engines;
        this.maxResults = maxResults;
        this.read = read;
    }
    validate() {
        if (this.engines.length === 0) {
            return 'engines must name at least one engine';
        }
        const unknown = this.engines.find((name) => !ENGINES.some((engine) => engine.name === name));
        if (unknown !== undefined) {
            return `unknown engine '${unknown}'`;
        }
        const max = this.maxResults;
        if (max !== undefined && !(Number.isInteger(max) && max > 0)) {
            return 'maxResults must be a positive integer';
        }
        return null;
    }
    setup() {
        const engines = this.engines.flatMap((name) => ENGINES.filter((engine) => engine.name === name));
        return { tools: [createWebSearchTool(engines, this.maxResults)] };
    }
}
