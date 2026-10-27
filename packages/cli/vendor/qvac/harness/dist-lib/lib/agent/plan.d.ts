import type { Message, PlanStep, ToolDefinition } from '../contract/index.ts';
export declare const PLAN_TOOL_NAME = "update_plan";
export declare const MAX_PLAN_STEPS = 12;
export declare function planSteps(args: Record<string, unknown>): PlanStep[];
export declare function planFromMessages(messages: readonly Message[]): PlanStep[];
export declare function createPlanTool(): ToolDefinition;
