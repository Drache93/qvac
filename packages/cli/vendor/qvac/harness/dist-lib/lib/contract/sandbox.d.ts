import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompiledPolicy, PolicyEnforcement } from './policy.ts';
export interface SandboxExecOptions {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    signal?: BareAbortSignal;
}
export interface SandboxExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface SandboxStartOptions {
    cwd?: string;
}
export interface SandboxJob {
    readonly exited: Promise<number>;
    stop(): Promise<void>;
}
export interface SandboxWorkspace {
    exec(command: string, options?: SandboxExecOptions): Promise<SandboxExecResult>;
    start(command: string, options?: SandboxStartOptions): Promise<SandboxJob>;
    close(): Promise<void>;
}
export interface SandboxService {
    readonly name: string;
    readonly isolated: boolean;
    readonly enforces?: PolicyEnforcement;
    open(workspaceDir: string, policy: CompiledPolicy): Promise<SandboxWorkspace>;
}
