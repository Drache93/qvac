import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
export interface LanguageHintOptions {
    minWords?: number;
    minProbability?: number;
}
export declare class LanguageHint implements HarnessPlugin {
    readonly name = "language-hint";
    readonly api = 1;
    readonly needs: string[];
    private readonly _minWords;
    private readonly _minProbability;
    constructor(options?: LanguageHintOptions);
    setup(ctx: PluginContext): PluginSetup;
    private _hint;
}
