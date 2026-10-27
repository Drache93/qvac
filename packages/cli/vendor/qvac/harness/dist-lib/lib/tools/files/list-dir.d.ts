import type { ToolDefinition } from '../../contract/index.ts';
import { type FsToolOptions } from '../fs/scope.ts';
import { type Grants } from '../fs/tool-path.ts';
export declare function createListDirTool({ realpath, deniedRoots }?: FsToolOptions): ToolDefinition;
export declare function folderArg(args: Record<string, unknown>, grants: Grants | undefined): string | undefined;
export declare function folderPaths(args: Record<string, unknown>, grants: Grants | undefined): string[];
