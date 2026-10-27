import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
export { KNOWLEDGE_SEARCH_TOOL } from './search-tool.ts';
export interface KnowledgeOptions {
    dir: string;
    model: string;
    maxChunks?: number;
    minScore?: number;
    tool?: boolean;
    read?: readonly string[];
}
export declare class Knowledge implements HarnessPlugin {
    readonly name = "knowledge";
    readonly api = 1;
    readonly provides: string[];
    readonly needs: string[];
    readonly read: readonly string[] | undefined;
    private readonly _options;
    constructor(options: KnowledgeOptions);
    validate(): string | null;
    setup(ctx: PluginContext): PluginSetup;
}
