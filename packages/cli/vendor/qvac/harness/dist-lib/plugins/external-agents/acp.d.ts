import type { TargetResult, TargetTask } from '../../lib/agent/index.ts';
export declare const ACP_PROTOCOL_VERSION = 1;
type Handler = (params: Record<string, unknown>) => unknown;
export declare class AcpClient {
    private readonly _send;
    private readonly _pending;
    private readonly _requests;
    private readonly _notifications;
    private _next;
    private _closed;
    constructor(send: (line: string) => void);
    request(method: string, params: unknown): Promise<unknown>;
    notify(method: string, params: unknown): void;
    handle(method: string, handler: Handler): void;
    on(method: string, handler: Handler): void;
    receive(line: string): void;
    close(error: Error): void;
    private _answer;
    private _reply;
}
export interface AcpTurnOptions {
    signal: AbortSignal;
    maxCostUsd?: number | undefined;
    graceMs: number;
}
export declare function acpTurn(client: AcpClient, task: TargetTask, options: AcpTurnOptions): Promise<TargetResult>;
export {};
