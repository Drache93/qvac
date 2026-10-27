import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
function lstatOrNull(p) {
    try {
        return fs.lstatSync(p);
    }
    catch {
        return null;
    }
}
function rejectSymlinkComponents(root, target) {
    const segments = target.slice(root.length).split(path.sep).filter(Boolean);
    let current = root;
    for (const segment of segments) {
        current = path.join(current, segment);
        const stat = lstatOrNull(current);
        if (!stat) {
            return;
        }
        if (stat.isSymbolicLink()) {
            throw new HarnessError('OBSIDIAN_PATH_CROSSES_SYMLINK', [target]);
        }
    }
}
export function ensureWithinRoot(root, rel) {
    const resolvedRoot = path.resolve(root);
    const target = path.resolve(resolvedRoot, rel);
    if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
        throw new HarnessError('OBSIDIAN_PATH_ESCAPES_VAULT', [rel]);
    }
    rejectSymlinkComponents(resolvedRoot, target);
    return target;
}
export function isSymlink(p) {
    return lstatOrNull(p)?.isSymbolicLink() === true;
}
export function writeNewFileText(filePath, content) {
    if (fs.existsSync(filePath)) {
        throw new HarnessError('OBSIDIAN_DESTINATION_EXISTS', [filePath]);
    }
    let fd;
    try {
        fd = fs.openSync(filePath, 'wx');
    }
    catch (error) {
        if (fs.existsSync(filePath)) {
            throw new HarnessError('OBSIDIAN_DESTINATION_EXISTS', [filePath]);
        }
        throw error;
    }
    try {
        fs.writeSync(fd, content);
    }
    finally {
        fs.closeSync(fd);
    }
}
