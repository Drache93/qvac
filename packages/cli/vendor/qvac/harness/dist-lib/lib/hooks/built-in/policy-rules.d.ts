import type { HarnessHook, HookContext, HookResult, PolicyRule } from '../../contract/index.ts';
export declare class PolicyRulesHook implements HarnessHook {
    readonly name = "policy-rules";
    readonly phase: 'preToolCall';
    readonly rules: readonly PolicyRule[];
    constructor(rules: readonly PolicyRule[]);
    run(ctx: HookContext): HookResult;
}
