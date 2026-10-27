import { getModelEntry } from '../runtime/model-registry.js';
import { getPlugin } from '../plugins/registry.js';
import { detectToolDialect } from '../utils/tool-integration.js';
import { ModelNotFoundError } from '../errors/index.js';
import { getEngineLogger } from '../logging/index.js';
const logger = getEngineLogger();
export function handleGetLoadedModelInfo(request) {
    const { modelId } = request;
    const entry = getModelEntry(modelId);
    if (!entry) {
        throw new ModelNotFoundError(modelId);
    }
    const plugin = getPlugin(entry.local.modelType);
    if (!plugin) {
        logger.warn(`getLoadedModelInfo: no plugin registered for modelType "${entry.local.modelType}" on loaded model "${modelId}"`);
    }
    const handlers = plugin ? Object.keys(plugin.handlers) : [];
    const fitProbe = entry.local.fitProbe;
    const info = {
        modelId: entry.id,
        modelType: entry.local.modelType,
        handlers,
        loadedAt: entry.local.loadedAt,
        ...(plugin && { displayName: plugin.displayName }),
        ...(plugin && { addonPackage: plugin.addonPackage }),
        ...(entry.local.name && { name: entry.local.name }),
        ...(entry.local.path && { path: entry.local.path }),
        ...(handlers.includes('completionStream') && {
            toolDialect: detectToolDialect(modelId)
        }),
        ...(fitProbe !== undefined && { fitProbe })
    };
    return { type: 'getLoadedModelInfo', info };
}
