import type { ToolExecutionOutcome } from '../contract/index.ts';
import type { HarnessHook, HookRejection, HookPhase, PolicyRule, PostToolCallPayload, PreFoldPayload, PreToolCallPayload, PromptSubmitPayload, RunEndPayload, RunLifecyclePayload, RunStartPayload, StopPayload, ToolFailurePayload } from '../contract/index.ts';
import { ArgRepairHook } from './built-in/arg-repair.ts';
import { EgressGuardHook } from './built-in/egress.ts';
import { PolicyRulesHook } from './built-in/policy-rules.ts';
import { SandboxHook } from './built-in/sandbox.ts';
import { SkillCatalogGuardHook } from './built-in/skill-catalog.ts';
export type PreToolFold = {
    ok: true;
    args: Record<string, unknown>;
    permission?: 'allow' | 'ask';
} | {
    ok: false;
    rejection: HookRejection;
};
export interface PostToolFold {
    result: unknown;
    outcome?: ToolExecutionOutcome;
    context?: string;
}
export type PromptFold = {
    ok: true;
    context?: string;
} | {
    ok: false;
    rejection: HookRejection;
};
declare function snapshotHooks(hooks: readonly HarnessHook[]): readonly HarnessHook[];
export declare class HookPipeline {
    static ArgRepairHook: typeof ArgRepairHook;
    static EgressGuardHook: typeof EgressGuardHook;
    static PolicyRulesHook: typeof PolicyRulesHook;
    static SandboxHook: typeof SandboxHook;
    static SkillCatalogGuardHook: typeof SkillCatalogGuardHook;
    static snapshot: typeof snapshotHooks;
    static defaults(): HarnessHook[];
    readonly hooks: readonly HarnessHook[];
    constructor(hooks?: readonly HarnessHook[]);
    withRules(rules: readonly PolicyRule[]): HookPipeline;
    hasPhase(phase: HookPhase): boolean;
    onRunLifecycle(payload: RunLifecyclePayload): Promise<void>;
    onRunStart(payload: Omit<RunStartPayload, 'phase'>): Promise<void>;
    onRunEnd(payload: Omit<RunEndPayload, 'phase'>): Promise<void>;
    promptSubmit(payload: Omit<PromptSubmitPayload, 'phase'>): Promise<PromptFold>;
    toolFailure(payload: Omit<ToolFailurePayload, 'phase'>): Promise<string | undefined>;
    stop(payload: Omit<StopPayload, 'phase'>): Promise<string | undefined>;
    preFold(payload: Omit<PreFoldPayload, 'phase'>): Promise<string | undefined>;
    runPreToolFold(payload: Omit<PreToolCallPayload, 'phase'>): Promise<PreToolFold>;
    runPostToolFold(payload: Omit<PostToolCallPayload, 'phase'>): Promise<PostToolFold>;
}
export {};
