import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type PythonLanguageOptions } from './language.ts';
import { closePythonWorker } from './worker/active.ts';
import { preloadPythonAddons } from './worker/client.ts';
export type { PythonLanguageOptions };
export { runPython, type LoadPyodideFn, type PythonRunResult } from './pyodide.ts';
export { planVendoredInstall, vendoredManifest, wheelsDir } from './wheels.ts';
export { closePythonWorker };
export declare class Python implements HarnessPlugin {
    readonly name = "python";
    readonly api = 1;
    readonly addons: {
        pyodide: typeof preloadPythonAddons;
    };
    private readonly _language;
    constructor(options?: PythonLanguageOptions);
    setup(): PluginSetup;
}
