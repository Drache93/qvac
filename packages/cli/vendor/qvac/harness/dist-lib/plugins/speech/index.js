import { PluginRegistry } from '../../lib/plugins/index.js';
import { invalidOptions } from './speech-engine.js';
import { SpeechRuntime } from './speech-runtime.js';
PluginRegistry.requirePeers('speech', {
    '@qvac/asr-ggml': () => import.meta.resolve('@qvac/asr-ggml/addonLogging'),
    '@qvac/decoder-audio': () => import.meta.resolve('@qvac/decoder-audio'),
    '@qvac/tts-ggml': () => import.meta.resolve('@qvac/tts-ggml/addonLogging'),
    'bare-ffmpeg': () => import.meta.resolve('bare-ffmpeg')
});
export class Speech {
    name = 'speech';
    api = PluginRegistry.API_VERSION;
    provides = ['speech'];
    needs = ['models'];
    addons = {
        'tts-ggml': () => import('@qvac/tts-ggml/addonLogging'),
        'asr-ggml': () => import('@qvac/asr-ggml/addonLogging'),
        'bare-ffmpeg': () => import('#audio-transcode')
    };
    _options;
    constructor(options = {}) {
        this._options = options;
    }
    validate() {
        return invalidOptions(this._options);
    }
    setup(ctx) {
        const runtime = new SpeechRuntime(ctx.service('models'), this._options);
        return { services: { speech: runtime }, unloadIdle: () => runtime.unloadIdle() };
    }
}
