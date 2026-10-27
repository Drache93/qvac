import type { ToolDefinition } from '../contract/index.ts';
import type { Toolset } from './toolsets.ts';
export interface ToolCatalogEntry {
    name: string;
    description: string;
    skillGated: boolean;
    scopeRequired: boolean;
    rootsRequired: boolean;
    writeRootsRequired: boolean;
    toolset: Toolset | null;
    promptChars: number;
}
export declare function toolCatalog(tools: ReadonlyArray<ToolDefinition>): ToolCatalogEntry[];
