import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
import { markdownFileName } from './note-name.js';
import { appendToFile, dailyCandidates, ensureWithinRoot, FRONTMATTER_RE, getArg, getContentArg, moveFile, readFileSnapshot, resolveNotePath, todayStamp, updateFileText, writeIfUnchanged } from './vault-paths.js';
export function handleAppend(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const content = getContentArg(args);
    if (!content) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['content=']);
    }
    appendToFile(notePath, content);
    return `Appended to: ${path.relative(vaultPath, notePath)}`;
}
export function handlePrepend(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const content = getContentArg(args);
    if (!content) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['content=']);
    }
    updateFileText(notePath, (existing) => content + existing);
    return `Prepended to: ${path.relative(vaultPath, notePath)}`;
}
function uniqueTrashPath(base) {
    if (!fs.existsSync(base))
        return base;
    const ext = base.endsWith('.md') ? '.md' : '';
    const stem = ext ? base.slice(0, -ext.length) : base;
    let n = 1;
    while (fs.existsSync(`${stem} (${n})${ext}`)) {
        n += 1;
    }
    return `${stem} (${n})${ext}`;
}
export function handleDelete(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const root = path.resolve(vaultPath);
    const trashPath = uniqueTrashPath(ensureWithinRoot(vaultPath, path.join('.trash', path.relative(root, notePath))));
    fs.mkdirSync(path.dirname(trashPath), { recursive: true });
    moveFile(notePath, trashPath);
    return `Moved to trash: ${path.relative(vaultPath, notePath)}`;
}
export function handleMove(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const to = getArg(args, 'to');
    if (!to) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['to=']);
    }
    const destDir = ensureWithinRoot(vaultPath, to);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, path.basename(notePath));
    moveFile(notePath, destPath);
    return `Moved to: ${path.relative(vaultPath, destPath)}`;
}
export function handleRename(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const newName = getArg(args, 'name');
    if (!newName) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['name=']);
    }
    const fileName = markdownFileName(newName);
    const relativeDir = path.relative(path.resolve(vaultPath), path.dirname(notePath));
    const destPath = ensureWithinRoot(vaultPath, path.join(relativeDir, fileName));
    moveFile(notePath, destPath);
    return `Renamed to: ${path.relative(vaultPath, destPath)}`;
}
function mergeIntoFrontmatter(fmBlock, newProps) {
    let result = fmBlock;
    for (const { key, value } of newProps) {
        const lineRe = new RegExp(`^${key}:.*$`, 'm');
        if (lineRe.test(result)) {
            result = result.replace(lineRe, `${key}: ${value}`);
        }
        else {
            result += `\n${key}: ${value}`;
        }
    }
    return result;
}
export function handlePropertySet(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    if (!notePath || !fs.existsSync(notePath)) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    const propArgs = args.filter((a) => !a.startsWith('file=') && !a.startsWith('path=') && a.includes('='));
    if (propArgs.length === 0) {
        throw new HarnessError('OBSIDIAN_NO_PROPERTIES');
    }
    const newProps = propArgs.map((a) => {
        const eqIdx = a.indexOf('=');
        return { key: a.slice(0, eqIdx), value: a.slice(eqIdx + 1) };
    });
    updateFileText(notePath, (content) => {
        const fmBlock = content.match(FRONTMATTER_RE)?.[1];
        if (fmBlock === undefined) {
            const lines = newProps.map(({ key, value }) => `${key}: ${value}`);
            return `---\n${lines.join('\n')}\n---\n${content}`;
        }
        const merged = mergeIntoFrontmatter(fmBlock, newProps);
        return content.replace(FRONTMATTER_RE, `---\n${merged}\n---`);
    });
    return `Properties updated: ${newProps.map((p) => p.key).join(', ')}`;
}
export function handleDailyAppend(vaultPath, args) {
    const content = getContentArg(args);
    if (!content) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['content=']);
    }
    const dateStr = todayStamp();
    let target = null;
    for (const candidate of dailyCandidates(vaultPath, dateStr)) {
        if (fs.existsSync(candidate)) {
            target = candidate;
            break;
        }
    }
    if (!target) {
        const dailyDir = ensureWithinRoot(vaultPath, 'Daily Notes');
        if (!fs.existsSync(dailyDir)) {
            fs.mkdirSync(dailyDir, { recursive: true });
        }
        target = ensureWithinRoot(vaultPath, path.join('Daily Notes', `${dateStr}.md`));
        const snap = readFileSnapshot(target);
        if (!snap) {
            writeIfUnchanged(target, '', null);
        }
    }
    appendToFile(target, content);
    return `Appended to daily note: ${dateStr}`;
}
