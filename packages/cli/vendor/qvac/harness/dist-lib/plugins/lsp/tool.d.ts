import type { ToolDefinition } from '../../lib/contract/index.ts';
import { type Realpath } from '../../lib/tools/fs/scope.ts';
import type { ServerPool } from './pool.ts';
import type { LspServerConfig } from './server.ts';
export interface LspToolOptions {
    readonly pool: ServerPool;
    readonly servers: readonly LspServerConfig[];
    readonly requestTimeoutMs: number;
    readonly deniedRoots?: readonly string[] | undefined;
    readonly realpath?: Realpath | undefined;
}
export declare function createLspTool(options: LspToolOptions): ToolDefinition;
