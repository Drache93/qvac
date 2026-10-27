import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { AskUserFn, AttachFn, FetchAttachmentFn, RunBudget, ToolDecision, ToolEffect, ToolExecuteContext, ToolParameterSchema, ToolSpill } from './index.ts';
import type { CompiledPolicy, PolicyEnforcement } from './policy.ts';
export interface ExecAttachment {
    readonly attachmentId: string;
    readonly fileName: string;
    readonly byteLength: number;
}
export interface RejectedOutput {
    readonly name: string;
    readonly reason: string;
}
export interface ExecResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
    readonly attachments?: readonly ExecAttachment[];
    readonly missingOutputs?: readonly string[];
    readonly rejectedOutputs?: readonly RejectedOutput[];
}
export interface SpawnOptions {
    cwd?: string;
    shell?: boolean;
    detached?: boolean;
    stdio?: [string, string, string] | string;
    env?: Record<string, string>;
}
export interface Child {
    readonly pid?: number;
    readonly stdout: {
        on(event: 'data', handler: (chunk: Buffer | string) => void): void;
    } | null;
    readonly stderr: {
        on(event: 'data', handler: (chunk: Buffer | string) => void): void;
    } | null;
    kill(signum?: number | string): void;
    on(event: 'exit', handler: (code: number | null, signal?: string | null) => void): void;
    on(event: 'error', handler: (err: Error) => void): void;
}
export type SpawnFn = (command: string, opts?: SpawnOptions) => Child;
export type KillProcess = (pid: number, signal: string) => void;
export interface ShellRuntime {
    readonly spawn: SpawnFn;
    readonly killProcess?: KillProcess;
}
export interface ExecutionOptions {
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
    readonly maxOutputChars?: number;
    readonly signal?: BareAbortSignal;
    readonly spill?: ToolSpill;
}
export interface ExecutionContext {
    readonly attach?: AttachFn;
    readonly fetchAttachment?: FetchAttachmentFn;
    readonly turnImages?: readonly {
        path: string;
    }[];
    readonly runBudget?: RunBudget;
    readonly policy?: CompiledPolicy;
    readonly toolNames?: readonly string[];
    readonly approval?: ToolDecision;
    readonly askUser?: AskUserFn;
}
export interface ExecutionPlan {
    run(options: ExecutionOptions): Promise<ExecResult> | ExecResult;
}
export interface ExecutionAdapter {
    resolve(args: Record<string, unknown>, ctx?: ExecutionContext): ExecutionPlan | null;
}
export interface FallbackExecutionAdapter {
    resolve(args: Record<string, unknown>, ctx?: ExecutionContext): ExecutionPlan;
}
export interface ExecShell extends FallbackExecutionAdapter {
    readonly name: string;
    readonly enforces?: PolicyEnforcement;
}
export interface ExecError {
    error: string;
}
export interface ExecLanguageWording {
    readonly runs: string;
    readonly guide: string;
    readonly command: string;
    readonly language: string;
    readonly properties: Readonly<Record<string, ToolParameterSchema>>;
}
export interface ExecLanguageText extends ExecLanguageWording {
    readonly workdir: string;
    readonly download: string;
    readonly prompt: ExecLanguageWording;
}
export interface ExecScope {
    readonly sandbox: boolean;
}
export interface ExecValidateScope extends ExecScope {
    readonly trusted: boolean;
    readonly toolNames?: readonly string[] | undefined;
}
export interface LanguageRun {
    readonly args: Record<string, unknown>;
    readonly trusted: boolean;
}
export interface LanguageCall {
    readonly args: Record<string, unknown>;
    readonly bundled?: {
        readonly label: string;
        load(skillsDir: string | undefined): LanguageRun | ExecError;
    };
}
export interface ExecLanguage extends ExecutionAdapter {
    readonly name: string;
    readonly text: ExecLanguageText;
    call(args: Record<string, unknown>): LanguageCall | ExecError | null;
    effect(args: Record<string, unknown>): ToolEffect;
    scope(args: Record<string, unknown>, scope: ExecScope): string | null;
    validate(args: Record<string, unknown>, scope: ExecValidateScope): string | null;
    label(args: Record<string, unknown>, scope: ExecScope): string;
    online(scope: ExecScope): boolean;
    redirect(args: Record<string, unknown>, scope: ExecScope): string | null;
    strays(args: Record<string, unknown>): string | null;
}
export interface ExecRouteOptions {
    readonly timeoutMs?: number;
    readonly maxOutputChars?: number;
    readonly signal?: BareAbortSignal;
    readonly runtime: () => Promise<ShellRuntime>;
}
export interface ExecRoute {
    readonly name: string;
    claims(command: string): boolean;
    run(command: string, ctx: ToolExecuteContext | undefined, options: ExecRouteOptions): Promise<ExecResult>;
}
