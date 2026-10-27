import type { ResponseFormat } from '../contract/index.ts';
import type { ToolCallDisplay } from '../contract/index.ts';
export declare const TOOL_LABEL_SCHEMA: ResponseFormat;
export declare function buildToolLabelPrompt(name: string, args: Record<string, unknown>): string;
export declare function skillCallLabel(args: Record<string, unknown>): string;
export declare function isSkillTool(name: string): boolean;
export declare function parseToolLabelResponse(raw: string): ToolCallDisplay | null;
export declare function fallbackToolLabel(name: string, args?: Record<string, unknown>): string;
