import type { ToolDefinition } from '../../contract/index.ts';
import { type FsToolOptions } from '../fs/scope.ts';
export declare function createWriteFileTool({ realpath, deniedRoots }?: FsToolOptions): ToolDefinition;
