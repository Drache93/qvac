import { HarnessError } from '../../lib/errors.js';
import { retryMemo } from '../../lib/helpers/retry-memo.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { createEditImageTool, loadMediaCodecs } from './edit-image.js';
import { createDiffusionRuntime, createGenerateImageTool } from './generate-image.js';
PluginRegistry.requirePeers('image', {
    '@qvac/diffusion-cpp': () => import.meta.resolve('@qvac/diffusion-cpp/addonLogging'),
    'bare-image-resample': () => import.meta.resolve('bare-image-resample'),
    'bare-media': () => import.meta.resolve('bare-media')
});
export { createEditImageTool } from './edit-image.js';
export { createDiffusionRuntime, createGenerateImageTool, generationPercentTick, settingsDimension, settingsSteps } from './generate-image.js';
function diffusionRuntime(models, model) {
    const loadSdk = retryMemo(async () => {
        const sdk = await models.sdk();
        if (typeof globalThis.Bare !== 'undefined') {
            const [{ diffusionPlugin }, { registerPlugin }] = await Promise.all([
                import('@qvac/inference/sdcpp-generation/plugin'),
                import('@qvac/inference/plugin-registry')
            ]);
            try {
                registerPlugin(diffusionPlugin);
            }
            catch { }
        }
        return sdk;
    });
    const transfers = new Map();
    return createDiffusionRuntime({
        ...(typeof model === 'string' ? { model } : model),
        loads: models,
        loadSdk,
        hold: models.hold,
        onProgress: (name, progress) => {
            const state = models.progressState(name, progress);
            if (state.status === 'downloading' &&
                typeof progress.percentage === 'number' &&
                progress.percentage < 100) {
                transfers.set(name, state);
            }
            models.emit(state.status === 'downloading' && !transfers.has(name)
                ? { ...state, status: 'loading' }
                : state);
        },
        onLoaded: (name) => {
            const transfer = transfers.get(name);
            if (!transfer) {
                return;
            }
            transfers.delete(name);
            models.statusChanged();
            models.emit({ ...transfer, status: 'downloaded' });
        },
        onBeforeLoad: (signal, srcs) => models.makeRoom(signal, new HarnessError('CHAT_MODEL_BUSY', ['image']), srcs)
    });
}
export class Image {
    name = 'image';
    api = PluginRegistry.API_VERSION;
    needs = ['models'];
    addons = {
        'diffusion-cpp': () => import('@qvac/diffusion-cpp/addonLogging'),
        'bare-image-resample': () => import('bare-image-resample'),
        'bare-media': loadMediaCodecs
    };
    read;
    _options;
    constructor(options) {
        this._options = options;
        this.read = options.read;
    }
    validate() {
        return this._options.model ? null : 'needs a model';
    }
    setup(ctx) {
        const { model, clamps } = this._options;
        const runtime = diffusionRuntime(ctx.service('models'), model);
        return {
            tools: [createGenerateImageTool(runtime, clamps), createEditImageTool(runtime, {}, clamps)],
            unload: () => runtime.unload(),
            unloadIdle: () => runtime.unloadIdle()
        };
    }
}
