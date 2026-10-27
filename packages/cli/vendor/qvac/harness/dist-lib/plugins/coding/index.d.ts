import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
export interface CodingOptions {
    readonly read?: readonly string[];
    readonly deniedRoots?: readonly string[];
}
export declare class CodingPlugin implements HarnessPlugin {
    static readonly TOOLS: readonly ['shell', 'shell_jobs'];
    readonly name = "coding";
    readonly api = 1;
    readonly needs: string[];
    readonly read: readonly string[] | undefined;
    readonly deniedRoots: readonly string[] | undefined;
    constructor({ read, deniedRoots }?: CodingOptions);
    setup(ctx: PluginContext): PluginSetup;
}
