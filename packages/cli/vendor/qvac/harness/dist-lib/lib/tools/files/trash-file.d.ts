import type { ToolDefinition } from '../../contract/index.ts';
import { type FsToolOptions } from '../fs/scope.ts';
export declare const TRASH_DIR = ".trash";
export declare function createTrashFileTool({ realpath, deniedRoots }?: FsToolOptions): ToolDefinition;
