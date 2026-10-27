import { relativeKey, searchTargets } from '../fs/targets.js';
import { compileGlob } from '../fs/glob.js';
import { callDenyRoots, defaultRealpath, isDeniedPath } from '../fs/scope.js';
import { anchorOf, shownPath, stringArg } from '../fs/tool-path.js';
import { walkFiles } from '../fs/walk.js';
import { folderArg, folderPaths } from './list-dir.js';
const GLOB_MATCHES = 100;
export function createGlobTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'glob',
        toolset: 'files',
        description: 'Find files in the shared folder by name pattern, newest first. "**" crosses folders: ' +
            '"**/*.md" finds every Markdown file, "*report*" matches names anywhere.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Name or path pattern, e.g. "**/*.pdf"' },
                dir: {
                    type: 'string',
                    description: 'Folder to search, relative to the shared folder (optional)'
                }
            },
            required: ['pattern']
        },
        effect: () => 'read',
        concurrent: true,
        stableRead: true,
        autoApprove: true,
        rootsRequired: true,
        validate: (args) => (stringArg(args, 'pattern') ? null : 'pattern is required'),
        paths: (args, ctx) => folderPaths(args, ctx),
        resource: (args) => ({ kind: 'file', label: `glob ${String(args.pattern ?? '')}` }),
        async execute(args, ctx) {
            const roots = ctx?.fsRoots ?? [];
            const deny = await callDenyRoots(deniedRoots, ctx?.policy, realpath);
            const scoped = await searchTargets(folderArg(args, ctx), roots, { realpath, deny });
            if ('error' in scoped) {
                return scoped;
            }
            const pattern = String(args.pattern);
            const test = compileGlob(pattern);
            const byName = !pattern.includes('/');
            const hits = [];
            let walkTruncated = false;
            for (const target of scoped.targets) {
                const walk = await walkFiles(target.root, target.folder);
                walkTruncated ||= walk.truncated;
                for (const file of walk.files) {
                    const rel = relativeKey(file.key, target.folder);
                    const name = rel.slice(rel.lastIndexOf('/') + 1);
                    if (isDeniedPath(file.path, deny) || !(test(rel) || (byName && test(name)))) {
                        continue;
                    }
                    const entry = await target.root.drive.entry(file.key);
                    hits.push({ path: shownPath(file.path, anchorOf(ctx)), mtime: entry?.mtime ?? 0 });
                }
            }
            hits.sort((a, b) => b.mtime - a.mtime);
            return {
                matches: hits.slice(0, GLOB_MATCHES).map((hit) => hit.path),
                truncated: walkTruncated || hits.length > GLOB_MATCHES || undefined
            };
        }
    };
}
