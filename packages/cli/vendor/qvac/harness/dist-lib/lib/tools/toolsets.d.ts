import type { Toolset } from '../contract/index.ts';
export type { Toolset };
export declare const TOOLSETS: readonly ["web-search", "knowledge", "files", "exec", "http-request", "mcp-call", "image", "music", "coding", "team"];
export declare function asToolset(value?: string | null): Toolset | null;
export declare function toolsetEnabled(toolset: Toolset, disabled?: ReadonlyArray<string> | null): boolean;
