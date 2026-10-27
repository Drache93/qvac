import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { EngineEntry } from './engine-registry.ts';
export declare function createWebSearchTool(engines: readonly EngineEntry[], maxResults?: number): ToolDefinition;
