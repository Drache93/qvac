import { errorMessage } from '../../guards.js';
import { searchTargets } from '../fs/targets.js';
import { compileGlob } from '../fs/glob.js';
import { callDenyRoots, defaultRealpath } from '../fs/scope.js';
import { DriveSearch } from '../fs/search.js';
import { anchorOf, shownPath, stringArg } from '../fs/tool-path.js';
import { MAX_WALK_ENTRIES, MAX_WALK_MS } from '../fs/walk.js';
import { folderArg, folderPaths } from './list-dir.js';
const GREP_MATCHES = 100;
const MAX_LIMIT = 500;
const MAX_LINE_CHARS = 300;
const TALLY_MATCHES = 5000;
const SPREAD_MATCHES = 1000;
const SPREAD_PER_FILE = 3;
const SPREAD_NAMED = 10;
const OUTPUTS = ['content', 'files', 'count'];
const isOutput = (value) => OUTPUTS.some((output) => output === value);
const ALTERNATIVE = /(?<![\\|])\|(?!\|)/;
const REGEX_LIKE = /\.\*|\\[a-z.(|]|^\^|\$$|\[[^\]]*\]|\(\?/i;
export function createGrepTool({ realpath = defaultRealpath, deniedRoots, maxWalkEntries = MAX_WALK_ENTRIES } = {}) {
    return {
        name: 'grep',
        toolset: 'files',
        description: 'Search inside the files of the shared folder. The pattern is plain text, case-insensitive; ' +
            '"a|b" finds either; set regex for a regular expression. Returns "path:line: text"; output ' +
            '"files" lists matching files with the first line and count, "count" counts per file. Narrow with include (e.g. "*.ts").',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Text to find' },
                dir: {
                    type: 'string',
                    description: 'Folder to search, relative to the shared folder (optional)'
                },
                include: {
                    type: 'string',
                    description: 'Only files whose name matches this pattern (optional)'
                },
                regex: { type: 'boolean', description: 'Treat pattern as a regular expression' },
                output: {
                    type: 'string',
                    enum: [...OUTPUTS],
                    description: 'content (default): matching lines; files: matching paths; count: per file'
                },
                limit: { type: 'number', description: `Most rows to return (default ${GREP_MATCHES})` },
                offset: { type: 'number', description: 'Rows to skip, to page past a cut-off answer' }
            },
            required: ['pattern']
        },
        effect: () => 'read',
        concurrent: true,
        stableRead: true,
        autoApprove: true,
        rootsRequired: true,
        validate(args) {
            if (!stringArg(args, 'pattern'))
                return 'pattern is required';
            if (args.output !== undefined && !isOutput(args.output)) {
                return `output is one of ${OUTPUTS.join(', ')}`;
            }
            for (const key of ['limit', 'offset']) {
                if (args[key] !== undefined && !(Number.isInteger(args[key]) && Number(args[key]) >= 0)) {
                    return `${key} is a whole number`;
                }
            }
            if (args.regex !== true) {
                return null;
            }
            try {
                new RegExp(String(args.pattern), 'i');
                return null;
            }
            catch (err) {
                return `invalid regex: ${errorMessage(err)}`;
            }
        },
        paths: (args, ctx) => folderPaths(args, ctx),
        resource: (args) => ({ kind: 'file', label: `grep ${String(args.pattern ?? '')}` }),
        async execute(args, ctx) {
            const roots = ctx?.fsRoots ?? [];
            const deny = await callDenyRoots(deniedRoots, ctx?.policy, realpath);
            const scoped = await searchTargets(folderArg(args, ctx), roots, { realpath, deny });
            if ('error' in scoped) {
                return scoped;
            }
            const pattern = String(args.pattern);
            const regex = args.regex === true;
            const queries = regex ? [pattern] : alternatives(pattern);
            const output = isOutput(args.output) ? args.output : 'content';
            const limit = Math.min(Number(args.limit ?? GREP_MATCHES), MAX_LIMIT);
            const offset = Number(args.offset ?? 0);
            const spread = args.output === undefined && args.limit === undefined && offset === 0;
            const wanted = spread ? SPREAD_MATCHES : reach(output, offset + limit);
            const query = {
                search: new DriveSearch(queries, { regex }),
                queries,
                regex,
                include: stringArg(args, 'include') ? includes(String(args.include), anchorOf(ctx)) : null,
                deny,
                maxEntries: maxWalkEntries
            };
            const hits = [];
            let truncated = false;
            for (const target of scoped.targets) {
                let found;
                try {
                    found = await searchTarget(target, {
                        ...query,
                        maxMatches: wanted + 1 - hits.length
                    });
                }
                catch (err) {
                    return { error: errorMessage(err) };
                }
                hits.push(...found.hits);
                truncated ||= found.truncated || found.cut;
                if (found.capped) {
                    break;
                }
            }
            const anchor = anchorOf(ctx);
            if (spread && hits.length > limit) {
                return {
                    matches: spreadRows(hits.slice(0, wanted), limit, (file) => shownPath(file, anchor)),
                    truncated: true
                };
            }
            const all = answerRows(hits.slice(0, wanted), output, (file) => shownPath(file, anchor));
            const rows = all.slice(offset, offset + limit);
            const more = all.length > offset + limit || hits.length > wanted;
            return {
                matches: rows.join('\n') || noMatches(pattern, { regex, offset, found: all.length }),
                truncated: truncated || more || undefined
            };
        }
    };
}
function includes(pattern, anchor) {
    const glob = compileGlob(pattern.replace(/^\.\//, ''));
    return pattern.includes('/') ? (_name, full) => glob(shownPath(full, anchor)) : glob;
}
const reach = (output, lines) => output === 'content' ? lines : TALLY_MATCHES;
function spreadRows(hits, limit, shown) {
    const files = new Map();
    for (const hit of hits) {
        files.set(hit.file, [...(files.get(hit.file) ?? []), hit]);
    }
    const take = new Map();
    let room = limit;
    for (const [file, list] of files) {
        const n = Math.min(list.length, SPREAD_PER_FILE, room);
        take.set(file, n);
        room -= n;
    }
    const bySize = [...files].sort(([, a], [, b]) => a.length - b.length);
    for (const [file, list] of bySize) {
        const n = Math.min(list.length - (take.get(file) ?? 0), room);
        take.set(file, (take.get(file) ?? 0) + n);
        room -= n;
    }
    const rows = [...files].flatMap(([file, list]) => list
        .slice(0, take.get(file))
        .map((hit) => `${shown(file)}:${hit.line}: ${hit.text.slice(0, MAX_LINE_CHARS)}`));
    const left = [...files]
        .map(([file, list]) => ({ file, n: list.length - (take.get(file) ?? 0) }))
        .filter(({ n }) => n > 0);
    const named = left.slice(0, SPREAD_NAMED).map(({ file, n }) => `${shown(file)} (${n})`);
    const rest = left.length > SPREAD_NAMED ? `, and ${left.length - SPREAD_NAMED} more files` : '';
    const more = left.reduce((sum, { n }) => sum + n, 0);
    return [...rows, `… ${more} more matching lines: ${named.join(', ')}${rest}`].join('\n');
}
function alternatives(pattern) {
    const parts = pattern
        .split(ALTERNATIVE)
        .map((part) => part.trim().replaceAll('\\|', '|'))
        .filter(Boolean);
    return parts.length ? parts : [pattern];
}
function answerRows(hits, output, shown) {
    if (output === 'content') {
        return hits.map((hit) => `${shown(hit.file)}:${hit.line}: ${hit.text.slice(0, MAX_LINE_CHARS)}`);
    }
    const files = new Map();
    for (const hit of hits) {
        const seen = files.get(hit.file);
        files.set(hit.file, seen ? { ...seen, n: seen.n + 1 } : { first: hit.line, n: 1 });
    }
    return [...files].map(([file, { first, n }]) => output === 'files' ? `${shown(file)}:${first} (${n})` : `${shown(file)}: ${n}`);
}
function noMatches(pattern, { regex, offset, found }) {
    if (found > 0)
        return `no matches past offset ${offset} (${found} in all)`;
    if (!regex && REGEX_LIKE.test(pattern)) {
        return 'no matches (the pattern was searched as plain text; set regex: true for a regular expression)';
    }
    return 'no matches';
}
function searchTarget({ root, folder }, { search, queries, regex, include, deny, maxEntries, maxMatches }) {
    if (root.kind === 'hyper' && root.search && !include) {
        return root.search({
            folder,
            queries: [...queries],
            regex,
            caseSensitive: false,
            includeIgnored: false,
            maxMatches,
            maxEntries,
            maxMs: MAX_WALK_MS
        });
    }
    return search.searchFolder(root, folder, { maxMatches, maxEntries, include, deny });
}
