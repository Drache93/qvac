import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompiledPolicy, ToolDefinition, ToolExecuteContext } from '../../lib/contract/index.ts';
import type { SandboxExecResult, SandboxJob, SandboxService, SandboxWorkspace } from '../../lib/contract/sandbox.ts';
import { type LocalRoot } from '../../lib/tools/fs/scope.ts';
export interface ToolError {
    error: string;
    guidance?: true;
}
export declare function guidance(error: string): ToolError;
export declare function isError(value: unknown): value is ToolError;
export declare function shellQuote(text: string): string;
export declare function errorText(error: unknown): string;
export declare function capped(text: string, stream: 'stdout' | 'stderr', ctx: ToolExecuteContext | undefined): Promise<string>;
interface ExecCall {
    timeoutMs?: number;
    signal?: BareAbortSignal | undefined;
}
export interface SessionLine {
    workspace: SandboxWorkspace;
    runId: string;
    line: string;
}
export declare class CodingSession {
    readonly sandbox: SandboxService;
    readonly deniedRoots: readonly string[];
    private readonly _bind;
    private readonly _workspaces;
    private readonly _runs;
    private readonly _keys;
    private readonly _moved;
    constructor(sandbox: SandboxService, deniedRoots?: readonly string[]);
    effect(ctx: ToolExecuteContext | undefined, args?: Record<string, unknown>): 'read' | 'write';
    refusal(ctx: ToolExecuteContext | undefined): ToolError | null;
    workspace(ctx: ToolExecuteContext | undefined): Promise<LocalRoot | ToolError>;
    policyVersion(): string;
    statePath(runId: string): string;
    open(root: LocalRoot, runId: string, policy: CompiledPolicy): Promise<SandboxWorkspace>;
    workspaceOf(runId: string): Promise<SandboxWorkspace> | null;
    private _prelude;
    exec({ workspace, runId, line }: SessionLine, { timeoutMs, signal }?: ExecCall): Promise<SandboxExecResult>;
    private _moves;
    jobLog(id: string): string;
    start({ workspace, runId, line }: SessionLine, id: string): Promise<SandboxJob>;
    execState(workspace: SandboxWorkspace, line: string): Promise<SandboxExecResult>;
    endRun(runId: string): Promise<void>;
    close(): Promise<void>;
}
export interface ShellToolOptions {
    session: CodingSession;
    start(call: SessionLine): Promise<unknown>;
}
export declare function shellTool(options: ShellToolOptions): ToolDefinition;
export {};
