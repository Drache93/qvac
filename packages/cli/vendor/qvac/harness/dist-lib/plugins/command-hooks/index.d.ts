import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
declare const EVENTS: {
    readonly PreToolUse: 'preToolCall';
    readonly PostToolUse: 'postToolCall';
    readonly PostToolUseFailure: 'toolFailure';
    readonly UserPromptSubmit: 'promptSubmit';
    readonly Stop: 'stop';
    readonly PreCompact: 'preFold';
    readonly SubagentStart: 'preToolCall';
    readonly SubagentStop: 'postToolCall';
};
declare const SKIPPED: readonly ['SessionStart', 'SessionEnd', 'Notification', 'PermissionRequest'];
export type ClaudeHookEvent = keyof typeof EVENTS;
export type SkippedClaudeHookEvent = (typeof SKIPPED)[number];
export interface ClaudeHookCommand {
    readonly type: 'command';
    readonly command: string;
    readonly timeout?: number | undefined;
}
export interface ClaudeHookMatcher {
    readonly matcher?: string;
    readonly hooks: readonly ClaudeHookCommand[];
}
export type ClaudeHooks = {
    readonly [Event in ClaudeHookEvent | SkippedClaudeHookEvent]?: readonly ClaudeHookMatcher[];
};
interface Readable {
    on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
}
interface Writable {
    on(event: 'error', listener: (error: Error) => void): unknown;
    write(chunk: string): unknown;
    end(): unknown;
}
export interface CommandProcess {
    readonly pid?: number | undefined;
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on(event: 'close', listener: (code: number | null) => void): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
}
export interface SpawnOptions {
    readonly cwd: string;
    readonly env: Record<string, string>;
}
export type SpawnCommand = (command: string, options: SpawnOptions) => CommandProcess;
export interface CommandHooksOptions {
    readonly cwd?: string;
    readonly spawn?: SpawnCommand;
}
export declare class CommandHooks implements HarnessPlugin {
    static readonly EVENTS: {
        readonly PreToolUse: 'preToolCall';
        readonly PostToolUse: 'postToolCall';
        readonly PostToolUseFailure: 'toolFailure';
        readonly UserPromptSubmit: 'promptSubmit';
        readonly Stop: 'stop';
        readonly PreCompact: 'preFold';
        readonly SubagentStart: 'preToolCall';
        readonly SubagentStop: 'postToolCall';
    };
    static readonly spawn: SpawnCommand;
    readonly name = "command-hooks";
    readonly api = 1;
    readonly addons: {
        'bare-subprocess': () => Promise<{
            constants: Record<string, number>;
            errors: typeof import("bare-subprocess").errors;
            Subprocess: typeof import("bare-subprocess").Subprocess;
            spawn(file: string, args?: string[] | null, opts?: import("bare-subprocess").SpawnOptions): import("bare-subprocess").Subprocess;
            spawn(file: string, opts?: import("bare-subprocess").SpawnOptions): import("bare-subprocess").Subprocess;
            spawnSync(file: string, args?: string[] | null, opts?: import("bare-subprocess").SpawnSyncOptions): import("bare-subprocess").SpawnSyncResult;
            spawnSync(file: string, opts?: import("bare-subprocess").SpawnSyncOptions): import("bare-subprocess").SpawnSyncResult;
            default: typeof import("bare-subprocess");
        }>;
    };
    private readonly _hooks;
    private readonly _cwd;
    private readonly _spawn;
    private readonly _stops;
    constructor(hooks: ClaudeHooks | undefined, options?: CommandHooksOptions);
    validate(): string | null;
    setup(): PluginSetup;
    private _run;
    private _stopState;
}
export {};
