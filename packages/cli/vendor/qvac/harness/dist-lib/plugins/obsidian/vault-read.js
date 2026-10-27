import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
import { dailyCandidates, ensureWithinRoot, FRONTMATTER_RE, getArg, listFolders, listMarkdownFiles, parseFrontmatter, readFileText, resolveNotePath, todayStamp } from './vault-paths.js';
function statOrNull(p) {
    try {
        return fs.statSync(p);
    }
    catch {
        return null;
    }
}
export function handleVault(vaultPath) {
    return JSON.stringify({ name: path.basename(vaultPath), path: vaultPath });
}
export function handleVaults(vaultPath) {
    return JSON.stringify([
        {
            name: path.basename(vaultPath),
            path: vaultPath,
            source: 'configured_vault_path',
            note: 'Vault file mode can access the configured vault folder only.'
        }
    ], null, 2);
}
export function handleRead(vaultPath, args) {
    const notePath = resolveNotePath(vaultPath, args);
    const stat = notePath ? statOrNull(notePath) : null;
    if (!notePath || !stat) {
        throw new HarnessError('OBSIDIAN_NOTE_NOT_FOUND', [args]);
    }
    if (stat.isDirectory()) {
        const folder = path.relative(path.resolve(vaultPath), notePath).split(path.sep).join('/');
        throw new HarnessError('OBSIDIAN_PATH_IS_FOLDER', [folder]);
    }
    return readFileText(notePath);
}
export function handleFiles(vaultPath, args) {
    const folder = getArg(args, 'folder');
    const dir = folder ? ensureWithinRoot(vaultPath, folder) : path.resolve(vaultPath);
    const files = listMarkdownFiles(dir, folder ?? '');
    return files.join('\n') || '(empty)';
}
export function handleFolders(vaultPath) {
    return listFolders(path.resolve(vaultPath)).join('\n') || '(empty)';
}
const SEARCH_LIMIT_DEFAULT = 50;
const SEARCH_LIMIT_MAX = 200;
function parseLimit(args) {
    const raw = getArg(args, 'limit');
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(n) || n <= 0) {
        return SEARCH_LIMIT_DEFAULT;
    }
    return Math.min(n, SEARCH_LIMIT_MAX);
}
export function handleSearch(vaultPath, args) {
    const query = getArg(args, 'query');
    if (!query) {
        throw new HarnessError('OBSIDIAN_MISSING_ARGUMENT', ['query=']);
    }
    const limit = parseLimit(args);
    const lowerQuery = query.toLowerCase();
    const files = listMarkdownFiles(path.resolve(vaultPath));
    const matches = [];
    for (const relPath of files) {
        if (matches.length >= limit)
            break;
        const fullPath = path.join(path.resolve(vaultPath), relPath);
        try {
            if (readFileText(fullPath).toLowerCase().includes(lowerQuery)) {
                matches.push(relPath);
            }
        }
        catch {
        }
    }
    if (matches.length === 0) {
        return `No results for "${query}"`;
    }
    const truncated = matches.length >= limit ? `\n(showing first ${limit}; narrow query for more)` : '';
    return matches.join('\n') + truncated;
}
export function handleProperties(vaultPath, args) {
    return JSON.stringify(parseFrontmatter(handleRead(vaultPath, args)), null, 2);
}
function countTags(tagCounts, content) {
    for (const match of content.matchAll(/#([a-zA-Z0-9_/-]+)/g)) {
        const tag = match[1];
        if (tag === undefined) {
            continue;
        }
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
}
export function handleTags(vaultPath) {
    const files = listMarkdownFiles(path.resolve(vaultPath));
    const tagCounts = new Map();
    for (const relPath of files) {
        try {
            countTags(tagCounts, readFileText(path.join(path.resolve(vaultPath), relPath)));
        }
        catch {
        }
    }
    const sorted = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.map(([tag, count]) => `#${tag} (${count})`).join('\n') || '(no tags)';
}
export function handleWordcount(vaultPath, args) {
    const body = handleRead(vaultPath, args).replace(FRONTMATTER_RE, '').trim();
    const words = body.split(/\s+/).filter(Boolean).length;
    return `${words} words`;
}
export function handleOutline(vaultPath, args) {
    const headings = handleRead(vaultPath, args)
        .split('\n')
        .filter((line) => /^#{1,6}\s/.test(line));
    return headings.join('\n') || '(no headings)';
}
export function handleDailyRead(vaultPath) {
    const dateStr = todayStamp();
    for (const p of dailyCandidates(vaultPath, dateStr)) {
        if (fs.existsSync(p)) {
            return readFileText(p);
        }
    }
    return `No daily note found for ${dateStr}`;
}
