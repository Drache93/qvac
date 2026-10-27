import { PluginRegistry } from '../../lib/plugins/index.js';
import { createJavaScriptLanguage } from './language.js';
import { Interpreter, MAX_DEADLINE_MS, SLICE_MS } from './runtime.js';
PluginRegistry.requirePeers('quickjs', {
    '@jitl/quickjs-singlefile-mjs-release-sync': () => import.meta.resolve('@jitl/quickjs-singlefile-mjs-release-sync'),
    'quickjs-emscripten-core': () => import.meta.resolve('quickjs-emscripten-core')
});
export class QuickJs {
    static MAX_DEADLINE_MS = MAX_DEADLINE_MS;
    static SLICE_MS = SLICE_MS;
    name = 'quickjs';
    api = PluginRegistry.API_VERSION;
    language;
    _interpreter;
    constructor({ memoryLimit = 64 * 1024 * 1024, stackSize = 256 * 1024 } = {}) {
        const interpreter = new Interpreter({ memoryLimit, stackSize });
        this._interpreter = interpreter;
        this.language = createJavaScriptLanguage(interpreter);
    }
    setup() {
        return { exec: { languages: [this.language] }, teardown: () => this._interpreter.close() };
    }
    evaluate(source, options) {
        return this._interpreter.evaluate(source, options);
    }
    run(source, options) {
        return this._interpreter.run(source, options);
    }
}
