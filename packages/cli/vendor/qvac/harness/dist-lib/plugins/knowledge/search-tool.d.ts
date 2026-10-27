import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { KnowledgeService } from '../../lib/contract/knowledge.ts';
export declare const KNOWLEDGE_SEARCH_TOOL = "knowledge_search";
export declare function knowledgeSearchTool(knowledge: KnowledgeService): ToolDefinition;
