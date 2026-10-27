import type { ToolDefinition } from '../contract/index.ts';
import type { FetchFn } from './http-request.ts';
import { type HostResolver } from './url-guard.ts';
export interface WebFetchToolOptions {
    fetch?: FetchFn;
    resolveHost?: HostResolver;
}
export declare function createWebFetchTool({ fetch: fetchImpl, resolveHost }?: WebFetchToolOptions): ToolDefinition;
