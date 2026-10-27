import { PluginRegistry } from '../../lib/plugins/index.js';
import { knowledgeSearchTool } from './search-tool.js';
import { KnowledgeStore } from './store.js';
export { KNOWLEDGE_SEARCH_TOOL } from './search-tool.js';
function invalid(config) {
    if (!config?.dir || !config.model) {
        return 'needs a dir and an embedding model';
    }
    const { maxChunks } = config;
    if (maxChunks !== undefined && !(Number.isSafeInteger(maxChunks) && maxChunks > 0)) {
        return 'maxChunks must be a positive integer';
    }
    if (config.minScore !== undefined && !Number.isFinite(config.minScore)) {
        return 'minScore must be a number';
    }
    return null;
}
export class Knowledge {
    name = 'knowledge';
    api = PluginRegistry.API_VERSION;
    provides = ['knowledge'];
    needs = ['embed'];
    read;
    _options;
    constructor(options) {
        this._options = options;
        this.read = options?.read;
    }
    validate() {
        return invalid(this._options);
    }
    setup(ctx) {
        const config = this._options;
        const store = new KnowledgeStore({
            dir: config.dir,
            model: config.model,
            maxChunks: config.maxChunks,
            minScore: config.minScore,
            embed: ctx.service('embed')
        });
        return {
            services: { knowledge: store },
            tools: config.tool ? [knowledgeSearchTool(store)] : [],
            teardown: () => store.close()
        };
    }
}
