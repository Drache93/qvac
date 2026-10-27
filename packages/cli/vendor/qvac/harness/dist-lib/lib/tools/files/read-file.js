import b4a from 'b4a';
import { errorMessage } from '../../guards.js';
import { documentText, isDocument } from '../fs/document-text.js';
import { createLocalRoots } from '../fs/local.js';
import { defaultRealpath, resolveKey } from '../fs/scope.js';
import { anchorOf, positiveInt, resolveRooted, rootedArgs, rootedPath, stringArg } from '../fs/tool-path.js';
const READ_LINES = 400;
const READ_CHARS = 20_000;
const BINARY_PROBE = 1024;
export function createReadFileTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'read_file',
        toolset: 'files',
        description: 'Read one file from the shared folder. Lines come back numbered ("12| text"). For a long file, ' +
            'read a range with startLine/endLine. PDF, Word and PowerPoint files come back as their text. ' +
            'Use this, not exec, for files in the shared folder.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path, relative to the shared folder' },
                startLine: { type: 'integer', description: 'First line to read (1-based, optional)' },
                endLine: { type: 'integer', description: 'Last line to read (optional)' }
            },
            required: ['path']
        },
        effect: () => 'read',
        concurrent: true,
        stableRead: true,
        autoApprove: true,
        rootsRequired: true,
        validate: (args) => (stringArg(args, 'path') ? null : 'path is required'),
        paths: (args, ctx) => rootedArgs(args, ctx, ['path']),
        resource(args, ctx) {
            const requested = stringArg(args, 'path');
            return requested ? { kind: 'file', label: rootedPath(requested, anchorOf(ctx)) } : null;
        },
        async execute(args, ctx) {
            const requested = String(args.path);
            const spill = ctx?.spill ? await createLocalRoots([ctx.spill.dir], realpath) : [];
            const own = spill.length ? await resolveKey(requested, spill, { realpath }) : null;
            const resolved = own && !('error' in own)
                ? own
                : await resolveRooted(requested, { grants: ctx, write: false, realpath, deniedRoots });
            if ('error' in resolved) {
                return resolved;
            }
            try {
                const text = await textOf(resolved, requested);
                if (typeof text !== 'string') {
                    return text;
                }
                return numbered(text, {
                    start: positiveInt(args.startLine),
                    end: positiveInt(args.endLine)
                });
            }
            catch (err) {
                return { error: errorMessage(err) };
            }
        }
    };
}
async function textOf(resolved, requested) {
    const { drive } = resolved.root;
    const bytes = (await drive.entry(resolved.key)) ? await drive.get(resolved.key) : null;
    if (bytes === null) {
        return { error: `no such file: ${requested}. Use list_dir or glob to find the right path.` };
    }
    if (isDocument(resolved.key)) {
        return documentText(resolved.key, bytes);
    }
    if (bytes.subarray(0, BINARY_PROBE).includes(0)) {
        return { error: `${requested} is a binary file (not text, PDF, Word or PowerPoint)` };
    }
    return b4a.toString(bytes, 'utf8');
}
function numbered(text, { start, end }) {
    const lines = text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    const total = lines.length;
    const first = Math.min(start ?? 1, Math.max(total, 1));
    const out = [];
    let chars = 0;
    let cut = false;
    for (let n = first; n <= Math.min(total, end ?? first + READ_LINES - 1); n++) {
        const row = `${n}| ${lines[n - 1]}`;
        if (chars + row.length > READ_CHARS) {
            cut = out.length === 0;
            if (cut) {
                out.push(row.slice(0, READ_CHARS));
            }
            break;
        }
        out.push(row);
        chars += row.length + 1;
    }
    const last = first + out.length - 1;
    const shown = cut
        ? `line ${first} of ${total}, cut at ${READ_CHARS} characters`
        : `lines ${first}-${last} of ${total}`;
    const header = last < total ? `${shown}; continue with startLine ${last + 1}` : shown;
    return { content: `${header}\n${out.join('\n')}` };
}
