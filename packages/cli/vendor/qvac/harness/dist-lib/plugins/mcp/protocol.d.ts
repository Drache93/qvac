import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolExecuteContext, ToolFetch } from '../../lib/contract/index.ts';
export declare const MCP_PROTOCOL_VERSION = "2025-03-26";
export declare const TIMEOUT_MS = 30000;
interface McpResponseBody {
    headers: {
        get(name: string): string | null;
    };
    text(): Promise<string>;
}
export declare function isNotification(method: string): boolean;
export interface McpRequest {
    method: string;
    params: Record<string, unknown> | undefined;
}
export declare function normalizeMethod(method: string, params: Record<string, unknown> | undefined): McpRequest;
export interface McpError {
    error: string;
}
export interface McpBody {
    body: string;
}
export declare function flattenMcpResponse(body: string): McpError | McpBody;
export declare function sessionKey(url: string, ctx: ToolExecuteContext | undefined, credentialKey?: string): string;
export declare function getSession(key: string): string;
export declare function deleteSession(key: string): void;
export declare function cacheSession(key: string, sessionId: string): void;
export interface McpPostOptions {
    readonly method: string;
    readonly params: Record<string, unknown> | undefined;
    readonly authHeader: string | null;
    readonly sessionId: string | undefined;
    readonly signal: BareAbortSignal;
}
export declare function post(fetch: ToolFetch, url: URL, { method, params, authHeader, sessionId, signal }: McpPostOptions): ReturnType<ToolFetch>;
export declare function readBody(response: McpResponseBody): Promise<string>;
export declare function needsSession(status: number, cached: string): boolean;
export interface McpSessionOptions {
    readonly authHeader: string | null;
    readonly signal: BareAbortSignal;
}
export interface McpSessionError extends McpError {
    stateless?: true;
}
export declare function establishSession(fetch: ToolFetch, url: URL, { authHeader, signal }: McpSessionOptions): Promise<string | McpSessionError>;
export {};
