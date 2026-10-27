import type { HarnessHook, HookContext, HookResult } from '../../contract/index.ts';
export declare class SandboxHook implements HarnessHook {
    readonly name = "sandbox";
    readonly phase: 'preToolCall';
    run(ctx: HookContext): HookResult;
}
