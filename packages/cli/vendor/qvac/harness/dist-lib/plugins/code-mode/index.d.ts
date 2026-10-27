import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { QuickJs } from '../quickjs/index.ts';
export declare const RUN_CODE_TOOL_NAME = "run_code";
export interface CodeModeOptions {
    readonly quickjs: QuickJs;
    readonly read?: readonly string[];
}
export declare class CodeMode implements HarnessPlugin {
    readonly name = "code-mode";
    readonly api = 1;
    readonly read: readonly string[] | undefined;
    readonly tool: ToolDefinition;
    constructor({ quickjs, read }: CodeModeOptions);
    setup(): PluginSetup;
}
