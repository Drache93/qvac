import type { ToolDefinition } from '../../contract/index.ts';
import type { SkillCatalogEntry } from '../skills/catalog.ts';
export interface CompileOperationToolsOptions {
    httpRequestTool?: ToolDefinition | undefined;
    mcpCallTool?: ToolDefinition | undefined;
}
export declare function compileOperationTools(catalog: readonly SkillCatalogEntry[], { httpRequestTool, mcpCallTool }: CompileOperationToolsOptions): ToolDefinition[];
