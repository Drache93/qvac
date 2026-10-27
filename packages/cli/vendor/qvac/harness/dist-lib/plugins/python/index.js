import { PluginRegistry } from '../../lib/plugins/index.js';
import { createPythonLanguage } from './language.js';
import { closePythonWorker } from './worker/active.js';
import { preloadPythonAddons } from './worker/client.js';
PluginRegistry.requirePeers('python', { pyodide: () => import.meta.resolve('pyodide') });
export { runPython } from './pyodide.js';
export { planVendoredInstall, vendoredManifest, wheelsDir } from './wheels.js';
export { closePythonWorker };
export class Python {
    name = 'python';
    api = PluginRegistry.API_VERSION;
    addons = { pyodide: preloadPythonAddons };
    _language;
    constructor(options = {}) {
        this._language = createPythonLanguage(options);
    }
    setup() {
        return { exec: { languages: [this._language] }, teardown: closePythonWorker };
    }
}
