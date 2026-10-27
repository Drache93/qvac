import { createEditFileTool } from './edit-file.js';
import { createGlobTool } from './glob.js';
import { createGrepTool } from './grep.js';
import { createListDirTool } from './list-dir.js';
import { createMakeDirTool } from './make-dir.js';
import { createReadFileTool } from './read-file.js';
import { createCopyFileTool, createMoveFileTool } from './transfer.js';
import { createTrashFileTool } from './trash-file.js';
import { createWriteFileTool } from './write-file.js';
export function createFileTools(options = {}) {
    return [
        createReadFileTool(options),
        createListDirTool(options),
        createGlobTool(options),
        createGrepTool(options),
        createWriteFileTool(options),
        createEditFileTool(options),
        createMoveFileTool(options),
        createCopyFileTool(options),
        createMakeDirTool(options),
        createTrashFileTool(options)
    ];
}
