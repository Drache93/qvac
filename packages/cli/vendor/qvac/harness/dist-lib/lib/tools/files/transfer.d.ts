import type { ToolDefinition } from '../../contract/index.ts';
import { type FsToolOptions } from '../fs/scope.ts';
export declare function createMoveFileTool(options?: FsToolOptions): ToolDefinition;
export declare function createCopyFileTool(options?: FsToolOptions): ToolDefinition;
