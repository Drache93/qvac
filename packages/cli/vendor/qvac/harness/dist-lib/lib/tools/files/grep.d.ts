import type { ToolDefinition } from '../../contract/index.ts';
import { type FsToolOptions } from '../fs/scope.ts';
export interface GrepToolOptions extends FsToolOptions {
    readonly maxWalkEntries?: number;
}
export declare function createGrepTool({ realpath, deniedRoots, maxWalkEntries }?: GrepToolOptions): ToolDefinition;
