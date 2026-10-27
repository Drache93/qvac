import type { HarnessHook, HookContext, HookRejection } from '../contract/index.ts';
export interface HookFold<Context extends HookContext> {
    ctx: Context;
    permission?: 'allow' | 'ask';
    context?: string;
    continue?: string;
    instructions?: string;
}
export declare function runHooks<Context extends HookContext>(hooks: readonly HarnessHook[], ctx: Context, match: (hook: HarnessHook, ctx: HookContext) => boolean): Promise<HookFold<Context> | HookRejection>;
