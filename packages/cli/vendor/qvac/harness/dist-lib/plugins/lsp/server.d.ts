import { type AbortSignalLike } from '../../lib/helpers/race-abort.ts';
import { type RequestOptions } from './rpc.ts';
export interface LspServerConfig {
    readonly language: string;
    readonly extensions: readonly string[];
    readonly command: string;
    readonly args?: readonly string[];
    readonly initializationOptions?: unknown;
}
interface Readable {
    on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
}
interface Writable {
    write(chunk: Uint8Array): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
}
export interface ServerProcess {
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on(event: 'exit', listener: (code: number | null) => void): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
    kill(signal?: 'SIGKILL'): unknown;
}
export interface SpawnOptions {
    readonly cwd: string;
    readonly env: Record<string, string>;
}
export type SpawnServer = (command: string, args: readonly string[], options: SpawnOptions) => ServerProcess;
export declare const spawnServer: SpawnServer;
export declare class LanguageServer {
    readonly config: LspServerConfig;
    readonly root: string;
    readonly exited: Promise<void>;
    capabilities: Record<string, unknown>;
    private readonly _child;
    private readonly _rpc;
    private readonly _open;
    private readonly _waiters;
    private readonly _markExited;
    private _failure;
    constructor(config: LspServerConfig, root: string, spawnFn?: SpawnServer);
    initialize(): Promise<void>;
    request(method: string, params: unknown, options?: RequestOptions): Promise<unknown>;
    notify(method: string, params?: unknown): void;
    withDocument<T>(uri: string, text: string, use: () => Promise<T>): Promise<T>;
    nextDiagnostics(uri: string, waitMs: number, signal?: AbortSignalLike): Promise<unknown>;
    stop(): Promise<void>;
    private _spawn;
    private _receive;
    private _fail;
    private _exitWithin;
    private _onNotification;
}
export {};
