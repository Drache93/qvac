import type { CompletionEvent, ToolDefinition, ToolExecuteContext } from '../contract/index.ts';
import type { EnhanceMode, Enhancer } from './enhance.ts';
declare const CAPABILITY_TOOLS: {
    readonly image: {
        readonly tool: 'generate_image';
        readonly enhances: 'prompt';
    };
    readonly translate: {
        readonly tool: 'translate';
    };
};
export type Capability = keyof typeof CAPABILITY_TOOLS;
export declare const CAPABILITIES: Capability[];
export declare function isCapability(name: string): name is Capability;
export interface InvokeOptions {
    capability: Capability;
    args: Record<string, unknown>;
    tools: readonly ToolDefinition[];
    ctx: ToolExecuteContext;
    enhance?: EnhanceMode;
    enhancer?: Enhancer;
}
export declare function invoke({ capability, args, tools, ctx, enhance, enhancer }: InvokeOptions): AsyncGenerator<CompletionEvent>;
export {};
