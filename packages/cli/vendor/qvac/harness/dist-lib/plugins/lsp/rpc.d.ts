import type { AbortSignal } from 'bare-abort-controller';
export interface RpcMessage {
    id?: number | string | null;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
export interface RequestOptions {
    signal?: AbortSignal | undefined;
    timeoutMs?: number | undefined;
}
export type NotificationHandler = (method: string, params: unknown) => void;
export declare function encodeMessage(message: RpcMessage): Buffer;
export declare class FrameDecoder {
    private _buffer;
    push(chunk: Uint8Array): RpcMessage[];
}
export declare class RpcConnection {
    private readonly _write;
    private readonly _onNotification;
    private readonly _decoder;
    private readonly _pending;
    private _nextId;
    private _closed;
    constructor(write: (bytes: Uint8Array) => void, onNotification: NotificationHandler);
    request(method: string, params: unknown, options?: RequestOptions): Promise<unknown>;
    notify(method: string, params?: unknown): void;
    receive(chunk: Uint8Array): void;
    close(reason: Error): void;
    private _take;
    private _dispatch;
    private _send;
}
