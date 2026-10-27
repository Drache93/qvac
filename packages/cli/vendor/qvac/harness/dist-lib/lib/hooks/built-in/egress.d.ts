import type { HarnessHook, HookContext, HookResult } from '../../contract/index.ts';
export declare class EgressGuardHook implements HarnessHook {
    readonly name = "egress-guard";
    readonly phase: 'preToolCall';
    run(ctx: HookContext): HookResult;
}
