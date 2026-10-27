import { HarnessError } from '../../lib/errors.js';
import { retryMemo } from '../../lib/helpers/retry-memo.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { createGenerateMusicTool, createMusicRuntime } from './generate-music.js';
PluginRegistry.requirePeers('music', {
    '@qvac/audiogen-ggml': () => import.meta.resolve('@qvac/audiogen-ggml/binding.js'),
    '@qvac/decoder-audio': () => import.meta.resolve('@qvac/decoder-audio')
});
export { audioDurationSeconds, backendDevice, backendName, CPU_FALLBACK_NOTICE, createGenerateMusicTool, createMusicRuntime, gpuFallback, musicPercentTick, pcmToWav, presentStats } from './generate-music.js';
export class Music {
    name = 'music';
    api = PluginRegistry.API_VERSION;
    needs = ['models'];
    addons = { 'audiogen-ggml': () => import('@qvac/audiogen-ggml/binding.js') };
    read;
    _options;
    constructor(options) {
        this._options = options;
        this.read = options?.read;
    }
    validate() {
        return this._options?.model ? null : 'needs a model';
    }
    setup(ctx) {
        const { model, clamps } = this._options;
        const models = ctx.service('models');
        const loadSdk = retryMemo(async () => {
            const sdk = await models.sdk();
            if (typeof globalThis.Bare !== 'undefined') {
                const [{ audioGenPlugin }, { registerPlugin }] = await Promise.all([
                    import('@qvac/inference/audiogen-ggml/plugin'),
                    import('@qvac/inference/plugin-registry')
                ]);
                try {
                    registerPlugin(audioGenPlugin);
                }
                catch { }
            }
            return sdk;
        });
        const runtime = createMusicRuntime({
            ...model,
            loads: models,
            loadSdk,
            hold: models.hold,
            onProgress: (name, progress) => models.emit(models.progressState(name, progress)),
            onBeforeLoad: (signal, srcs) => models.makeRoom(signal, new HarnessError('CHAT_MODEL_BUSY', ['music']), srcs)
        });
        return {
            tools: [createGenerateMusicTool(runtime, clamps)],
            unload: () => runtime.unload(),
            unloadIdle: () => runtime.unloadIdle()
        };
    }
}
