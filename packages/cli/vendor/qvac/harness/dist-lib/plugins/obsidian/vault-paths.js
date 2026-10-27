import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
import { ensureWithinRoot, isSymlink, writeNewFileText } from './safe-path.js';
export { ensureWithinRoot, writeNewFileText } from './safe-path.js';
export const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
export function resolveNotePath(vaultPath, args) {
    const fileArg = args.find((a) => a.startsWith('file='));
    const pathArg = args.find((a) => a.startsWith('path='));
    if (pathArg) {
        return ensureWithinRoot(vaultPath, pathArg.slice('path='.length));
    }
    if (fileArg) {
        const name = fileArg.slice('file='.length);
        const withExt = name.endsWith('.md') ? name : `${name}.md`;
        const direct = ensureWithinRoot(vaultPath, withExt);
        if (fs.existsSync(direct)) {
            return direct;
        }
        return findFileRecursive(vaultPath, withExt);
    }
    return null;
}
function readDirEntries(dir) {
    let names;
    try {
        names = fs.readdirSync(dir);
    }
    catch {
        return [];
    }
    const out = [];
    for (const name of names) {
        if (name.startsWith('.'))
            continue;
        const full = path.join(dir, name);
        if (isSymlink(full)) {
            continue;
        }
        let stat;
        try {
            stat = fs.statSync(full);
        }
        catch {
            continue;
        }
        out.push({ name, full, isDir: stat.isDirectory() });
    }
    return out;
}
function namesMatch(a, b) {
    return a === b || a.toLowerCase() === b.toLowerCase();
}
function findFileRecursive(dir, target) {
    for (const entry of readDirEntries(dir)) {
        if (entry.isDir) {
            const found = findFileRecursive(entry.full, target);
            if (found) {
                return found;
            }
        }
        else if (namesMatch(entry.name, target)) {
            return entry.full;
        }
    }
    return null;
}
export function readFileText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}
export function readFileSnapshot(filePath) {
    let stat;
    try {
        stat = fs.statSync(filePath);
    }
    catch {
        return null;
    }
    if (!stat.isFile()) {
        return null;
    }
    return { text: fs.readFileSync(filePath, 'utf8'), mtimeMs: stat.mtimeMs };
}
export function writeIfUnchanged(filePath, content, expectedMtimeMs) {
    let current = null;
    try {
        current = fs.statSync(filePath);
    }
    catch {
        current = null;
    }
    if (expectedMtimeMs === null) {
        if (current) {
            throw new HarnessError('OBSIDIAN_NOTE_CHANGED', ['file appeared', path.basename(filePath)]);
        }
        fs.writeFileSync(filePath, content);
        return;
    }
    if (!current || current.mtimeMs !== expectedMtimeMs) {
        throw new HarnessError('OBSIDIAN_NOTE_CHANGED', ['re-read and retry', path.basename(filePath)]);
    }
    fs.writeFileSync(filePath, content);
}
export function updateFileText(filePath, transform) {
    const snap = readFileSnapshot(filePath);
    if (!snap) {
        writeIfUnchanged(filePath, transform(''), null);
        return;
    }
    writeIfUnchanged(filePath, transform(snap.text), snap.mtimeMs);
}
export function appendToFile(filePath, content) {
    updateFileText(filePath, (existing) => existing + content);
}
export function moveFile(src, dest) {
    const content = readFileText(src);
    writeNewFileText(dest, content);
    fs.rmSync(src);
}
export function listMarkdownFiles(dir, prefix = '') {
    const results = [];
    for (const entry of readDirEntries(dir)) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDir) {
            results.push(...listMarkdownFiles(entry.full, rel));
        }
        else if (entry.name.endsWith('.md')) {
            results.push(rel);
        }
    }
    return results;
}
export function listFolders(dir, prefix = '') {
    const results = [];
    for (const entry of readDirEntries(dir)) {
        if (entry.isDir) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            results.push(rel);
            results.push(...listFolders(entry.full, rel));
        }
    }
    return results;
}
export function parseFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match?.[1]) {
        return {};
    }
    const props = {};
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            continue;
        }
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key) {
            props[key] = value;
        }
    }
    return props;
}
export function getContentArg(args) {
    const arg = args.find((a) => a.startsWith('content='));
    if (!arg) {
        return '';
    }
    return arg.slice('content='.length).replace(/\\n/g, '\n');
}
export function getArg(args, key) {
    const arg = args.find((a) => a.startsWith(`${key}=`));
    return arg ? arg.slice(key.length + 1) : undefined;
}
export function todayStamp() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
export function* dailyCandidates(vaultPath, dateStr) {
    yield ensureWithinRoot(vaultPath, `${dateStr}.md`);
    yield ensureWithinRoot(vaultPath, path.join('Daily Notes', `${dateStr}.md`));
    yield ensureWithinRoot(vaultPath, path.join('daily', `${dateStr}.md`));
}
