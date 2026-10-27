import fs from 'fs';
import { relativeKey, searchTargets } from '../fs/targets.js';
import { callDenyRoots, defaultRealpath, displayPath, hostPath, isDeniedPath } from '../fs/scope.js';
import { anchorOf, rootedPath, stringArg } from '../fs/tool-path.js';
import { WALK_SKIP_DIRS, walkFiles } from '../fs/walk.js';
const LIST_ENTRIES = 200;
export function createListDirTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'list_dir',
        toolset: 'files',
        description: 'List a folder inside the shared folder: each entry with its type, size and last change. ' +
            'Leave path empty for the shared folder itself. Use this, not exec, to look inside it.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Folder, relative to the shared folder (optional)' }
            }
        },
        effect: () => 'read',
        concurrent: true,
        stableRead: true,
        autoApprove: true,
        rootsRequired: true,
        paths: (args, ctx) => folderPaths(args, ctx),
        resource: (args, ctx) => ({
            kind: 'file',
            label: `list ${folderArg(args, ctx) ?? 'shared folder'}`
        }),
        async execute(args, ctx) {
            const roots = ctx?.fsRoots ?? [];
            const deny = await callDenyRoots(deniedRoots, ctx?.policy, realpath);
            const scoped = await searchTargets(folderArg(args, ctx), roots, { realpath, deny });
            if ('error' in scoped) {
                return scoped;
            }
            const { entries, truncated } = await collect(scoped.targets, { deny, anchor: anchorOf(ctx) });
            const rows = await describe([...entries].slice(0, LIST_ENTRIES));
            return {
                entries: rows.join('\n') || '(empty)',
                truncated: truncated || entries.size > LIST_ENTRIES || undefined
            };
        }
    };
}
export function folderArg(args, grants) {
    const folder = stringArg(args, 'dir') ?? stringArg(args, 'path');
    return folder && folder !== '.' && folder !== '/'
        ? rootedPath(folder, anchorOf(grants))
        : undefined;
}
export function folderPaths(args, grants) {
    const folder = folderArg(args, grants);
    return folder ? [folder] : (grants?.fsRoots ?? []).map((root) => displayPath(root, '/'));
}
async function collect(targets, { deny, anchor }) {
    const entries = new Map();
    let truncated = false;
    for (const target of targets) {
        const own = targets.length === 1 || target.root === anchor;
        const level = target.root.kind === 'local'
            ? await localLevel(target.root, target.folder, deny)
            : await walkedLevel(target, deny);
        truncated ||= level.truncated;
        for (const child of level.children) {
            const name = own ? child.name : displayPath(target.root, child.key);
            entries.set(name, { ...child, drive: target.root.drive });
        }
    }
    return { entries, truncated };
}
async function localLevel(root, folder, deny) {
    const children = [];
    for (const dirent of await readdir(hostPath(root, folder))) {
        const key = childKey(folder, dirent.name);
        if (dirent.isSymbolicLink() || isDeniedPath(hostPath(root, key), deny)) {
            continue;
        }
        if (dirent.isDirectory() && !WALK_SKIP_DIRS.has(dirent.name)) {
            const items = (await readdir(hostPath(root, key))).length;
            children.push({ name: dirent.name, key, folder: true, items });
        }
        else if (dirent.isFile()) {
            children.push({ name: dirent.name, key, folder: false, items: 0 });
        }
        if (children.length > LIST_ENTRIES) {
            return { children, truncated: true };
        }
    }
    return { children, truncated: false };
}
async function walkedLevel(target, deny) {
    const walk = await walkFiles(target.root, target.folder);
    const children = [];
    const folders = new Map();
    for (const file of walk.files) {
        if (isDeniedPath(file.path, deny))
            continue;
        const [name, below] = relativeKey(file.key, target.folder).split('/');
        if (below === undefined) {
            children.push({ name, key: file.key, folder: false, items: 0 });
            continue;
        }
        folders.set(name, (folders.get(name) ?? new Set()).add(below));
    }
    for (const [name, items] of folders) {
        children.push({ name, key: childKey(target.folder, name), folder: true, items: items.size });
    }
    return { children, truncated: walk.truncated };
}
async function readdir(dir) {
    try {
        return await fs.promises.readdir(dir, { withFileTypes: true });
    }
    catch {
        return [];
    }
}
function childKey(folder, name) {
    return folder === '/' ? `/${name}` : `${folder}/${name}`;
}
async function describe(entries) {
    const rows = [];
    for (const [name, entry] of entries) {
        if (entry.folder) {
            rows.push(`${name}/  (folder, ${entry.items} ${entry.items === 1 ? 'item' : 'items'})`);
            continue;
        }
        const stat = await entry.drive.entry(entry.key);
        const size = stat?.value.blob?.byteLength ?? 0;
        const changed = stat?.mtime
            ? `, changed ${new Date(stat.mtime).toISOString().slice(0, 16)}`
            : '';
        rows.push(`${name}  (${size} bytes${changed})`);
    }
    return rows;
}
