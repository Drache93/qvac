import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import type { ExecLanguage, ExecResult } from '../../lib/contract/exec.ts';
import { type EvaluateOptions, type HostFunction, type ScriptOptions, type ScriptResult } from './runtime.ts';
export type { EvaluateOptions, HostFunction, ScriptOptions, ScriptResult };
export interface QuickJsOptions {
    readonly memoryLimit?: number;
    readonly stackSize?: number;
}
export declare class QuickJs implements HarnessPlugin {
    static readonly MAX_DEADLINE_MS = 30000;
    static readonly SLICE_MS = 10000;
    readonly name = "quickjs";
    readonly api = 1;
    readonly language: ExecLanguage;
    private readonly _interpreter;
    constructor({ memoryLimit, stackSize }?: QuickJsOptions);
    setup(): PluginSetup;
    evaluate(source: string, options?: EvaluateOptions): Promise<ExecResult>;
    run(source: string, options?: ScriptOptions): Promise<ScriptResult>;
}
