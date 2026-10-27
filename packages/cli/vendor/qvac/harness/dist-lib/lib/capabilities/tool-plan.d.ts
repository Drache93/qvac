import type { HookRejection, ResolvedCall, ToolEffect, ToolExecuteContext } from '../contract/index.ts';
import { type CompletionSkillEntry } from './skill-entry.ts';
import type { SkillActivation } from '../contract/index.ts';
import type { CompletionContext } from '../machine/index.ts';
export interface ToolPolicyFacts {
    readonly call: NonNullable<CompletionContext['currentCall']>;
    readonly toolAvailable: boolean;
    readonly skillCall: boolean;
    readonly skillAlreadyLoaded: boolean;
    readonly skillStatus: string | null;
    readonly skillActive: boolean;
    readonly skillName: string;
    readonly alreadyLoadedLabel: string;
    readonly unavailableSkillMessage: string;
    readonly searchCapReached: boolean;
    readonly searchCapMessage: string;
    readonly hookRejection: HookRejection | null;
    readonly source: 'skill' | 'tool-result';
    readonly effect: ToolEffect | undefined;
}
export interface PlanToolCallOptions {
    readonly activation: SkillActivation;
    readonly skillCatalog: readonly CompletionSkillEntry[];
    readonly loadedThisTurn: ReadonlySet<string>;
    readonly loadedFilesThisTurn: ReadonlySet<string>;
    readonly webSearches: number;
    readonly context: ToolExecuteContext;
    readonly shownSkills: readonly string[];
}
interface KeyedResolvedCall extends ResolvedCall {
    key: string;
}
export declare function planToolCall(resolved: KeyedResolvedCall, opts: PlanToolCallOptions): ToolPolicyFacts;
export declare function skillNameOf(args: Record<string, unknown>): string;
export declare function withCatalogSkillName<Call extends {
    name: string;
    arguments: Record<string, unknown>;
}>(call: Call, catalog: readonly CompletionSkillEntry[]): Call;
export declare function skillFileKey(skillName: string, args: Record<string, unknown>): string | null;
export {};
