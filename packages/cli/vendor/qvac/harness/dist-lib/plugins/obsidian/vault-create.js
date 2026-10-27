import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
import { markdownFileName } from './note-name.js';
import { ensureWithinRoot, getArg, getContentArg, writeNewFileText } from './vault-paths.js';
function markdownPath(vaultPath, target) {
    const notePath = target.endsWith('.md') ? target : `${target}.md`;
    return ensureWithinRoot(vaultPath, notePath);
}
function createAtPath(vaultPath, target, content) {
    const filePath = markdownPath(vaultPath, target);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeNewFileText(filePath, content);
    return `Created: ${path.relative(vaultPath, filePath)}`;
}
function createNamed(vaultPath, { name, folder, content }) {
    const dir = folder ? ensureWithinRoot(vaultPath, folder) : path.resolve(vaultPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = markdownFileName(name);
    const filePath = ensureWithinRoot(vaultPath, path.join(folder, fileName));
    if (fs.existsSync(filePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_EXISTS', [name, folder || '/']);
    }
    writeNewFileText(filePath, content);
    return `Created: ${folder ? `${folder}/` : ''}${fileName}`;
}
export function handleCreate(vaultPath, args) {
    const content = getContentArg(args);
    const name = getArg(args, 'name');
    if (name) {
        return createNamed(vaultPath, {
            name,
            folder: getArg(args, 'path') || '',
            content: content || ''
        });
    }
    const filePath = getArg(args, 'path');
    const file = getArg(args, 'file');
    if (filePath && file) {
        return createNamed(vaultPath, { name: file, folder: filePath, content: content || '' });
    }
    const target = filePath ?? file;
    if (!target) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['name=, file=, or path=']);
    }
    return createAtPath(vaultPath, target, content || '');
}
