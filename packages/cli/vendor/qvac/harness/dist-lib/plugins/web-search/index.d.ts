import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type EngineName } from './engine-registry.ts';
export type { EngineName } from './engine-registry.ts';
export interface WebSearchOptions {
    readonly engines?: readonly EngineName[];
    readonly maxResults?: number;
    readonly read?: readonly string[];
}
export declare class WebSearchPlugin implements HarnessPlugin {
    readonly name = "web-search";
    readonly api = 1;
    readonly read: readonly string[] | undefined;
    readonly engines: readonly EngineName[];
    readonly maxResults: number | undefined;
    constructor({ engines, maxResults, read }?: WebSearchOptions);
    validate(): string | null;
    setup(): PluginSetup;
}
