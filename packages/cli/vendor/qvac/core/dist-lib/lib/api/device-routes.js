import b4a from 'b4a';
import { Readable } from 'streamx';
import { asError } from '../guards.js';
import { CoreError } from '../errors.js';
import { frameReadable } from '../frame-readable.js';
import { MODEL_IDLE_UNLOAD_KEY, MODEL_MEMORY_CAP_KEY } from '../constants.js';
const SIBLING_CONFIG_KEYS = new Set([
    MODEL_IDLE_UNLOAD_KEY,
    MODEL_MEMORY_CAP_KEY
]);
export const DEVICE_ROUTES = [
    'listModels',
    'deleteModel',
    'loadModel',
    'unloadModel',
    'retryModelDownload',
    'clearModelDownload',
    'modelCatalogWatch',
    'modelDownloadsWatch',
    'customModelsWatch',
    'previewCustomModel',
    'addCustomModel',
    'removeCustomModel',
    'modelUsers',
    'modelsWatch',
    'configGet',
    'configSet',
    'configWatch',
    'setModelPaused'
];
function modelRoutes(at) {
    return {
        listModels: (input) => answer(at(input).listModels, 'listModels', here(input)),
        deleteModel: (input) => answer(at(input).deleteModel, 'deleteModel', here(input)),
        loadModel: (input) => answer(at(input).loadModel, 'loadModel', here(input)),
        unloadModel: (input) => answer(at(input).unloadModel, 'unloadModel', here(input)),
        retryModelDownload: (input) => answer(at(input).retryModelDownload, 'retryModelDownload', here(input)),
        clearModelDownload: (input) => answer(at(input).clearModelDownload, 'clearModelDownload', here(input)),
        modelCatalogWatch: (input = {}) => watched(() => required(at(input).modelCatalogWatch, 'modelCatalogWatch')(here(input))),
        modelDownloadsWatch: (input = {}) => watched(() => required(at(input).modelDownloadsWatch, 'modelDownloadsWatch')(here(input))),
        customModelsWatch: (input = {}) => watched(() => required(at(input).customModelsWatch, 'customModelsWatch')(here(input))),
        previewCustomModel: (input) => answer(at(input).previewCustomModel, 'previewCustomModel', here(input)),
        addCustomModel: (input) => answer(at(input).addCustomModel, 'addCustomModel', here(input)),
        removeCustomModel: (input) => answer(at(input).removeCustomModel, 'removeCustomModel', here(input)),
        modelUsers: (input) => answer(at(input).modelUsers, 'modelUsers', here(input)),
        modelsWatch: (input = {}) => watched(() => required(at(input).modelsWatch, 'modelsWatch')(here(input))),
        configGet: (input) => answer(at(input).configGet, 'configGet', here(input)),
        configSet: (input) => answer(at(input).configSet, 'configSet', here(input)),
        configWatch: (input) => watched(() => required(at(input).configWatch, 'configWatch')(here(input))),
        setModelPaused: (input) => answer(at(input).setModelPaused, 'setModelPaused', here(input))
    };
}
export function forwardToDevices(local, opts) {
    const { deviceId, remote } = opts;
    const elsewhere = (input) => {
        const target = input?.deviceId;
        return target && !b4a.equals(target, deviceId) ? target : null;
    };
    const at = (input) => {
        const target = elsewhere(input);
        return target ? remote(target) : local;
    };
    return modelRoutes(at);
}
export function servedToSiblings(local) {
    const routes = modelRoutes(() => local);
    return {
        ...routes,
        previewCustomModel: (input) => {
            refuseLocalSources(input);
            return routes.previewCustomModel(input);
        },
        addCustomModel: (input) => {
            refuseLocalSources(input);
            return routes.addCustomModel(input);
        },
        configGet: (input) => {
            refuseOtherKeys(input);
            return routes.configGet(input);
        },
        configSet: (input) => {
            refuseOtherKeys(input);
            return routes.configSet(input);
        },
        configWatch: (input) => watched(() => {
            refuseOtherKeys(input);
            return routes.configWatch(input);
        })
    };
}
function here(input) {
    const local = { ...input };
    delete local.deviceId;
    return local;
}
function required(handler, route) {
    if (!handler) {
        throw new CoreError('DEVICE_ROUTE_NOT_SERVED', [route]);
    }
    return handler;
}
function watched(open) {
    try {
        return open();
    }
    catch (err) {
        return frameReadable(new Readable({ read: (cb) => cb(asError(err)) }));
    }
}
async function answer(handler, route, input) {
    return await required(handler, route)(input);
}
function refuseLocalSources(input) {
    const sources = [input.src, input.mmprojSrc].filter((src) => !!src);
    if (!sources.every((src) => /^https?:\/\//i.test(src?.trim() ?? ''))) {
        throw new CoreError('LINK_SOURCES_ONLY');
    }
}
function refuseOtherKeys({ key }) {
    if (!SIBLING_CONFIG_KEYS.has(key)) {
        throw new CoreError('MODEL_SETTINGS_ONLY');
    }
}
