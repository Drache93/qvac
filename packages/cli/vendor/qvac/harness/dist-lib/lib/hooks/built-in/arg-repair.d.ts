import type { HarnessHook, HookContext, HookResult } from '../../contract/index.ts';
export declare class ArgRepairHook implements HarnessHook {
    readonly name = "arg-repair";
    readonly phase: 'preToolCall';
    run(ctx: HookContext): HookResult;
}
