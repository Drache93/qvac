import { errorMessage } from '../../guards.js';
import { defaultRealpath } from '../fs/scope.js';
import { existsNow, resolveRooted, rootedArgs, rootedLabel, stringArg } from '../fs/tool-path.js';
import { writeText } from '../fs/write.js';
export function createWriteFileTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'write_file',
        toolset: 'files',
        description: 'Write a whole file in the shared folder: creates it (and its folders) or replaces it completely. ' +
            'Replacing an existing file asks the user first. For a small change, use edit_file. ' +
            'Use this, not exec, to write files in the shared folder.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path, relative to the shared folder' },
                content: { type: 'string', description: 'The complete new content' }
            },
            required: ['path', 'content']
        },
        effect: (args, ctx) => (existsNow(stringArg(args, 'path'), ctx) ? 'write' : 'read'),
        writeRootsRequired: true,
        paths: (args, ctx) => rootedArgs(args, ctx, ['path']),
        validate: (args) => stringArg(args, 'path') && typeof args.content === 'string'
            ? null
            : 'path and content are required',
        resource: (args, ctx) => ({
            kind: 'file',
            label: `${rootedLabel('write', { grants: ctx, paths: [String(args.path)] })}, ${String(args.content ?? '').length} chars`
        }),
        async execute(args, ctx) {
            const requested = String(args.path);
            const resolved = await resolveRooted(requested, {
                grants: ctx,
                write: true,
                realpath,
                deniedRoots
            });
            if ('error' in resolved) {
                return resolved;
            }
            try {
                const existing = await resolved.root.drive.entry(resolved.key);
                if (existing !== null && ctx?.approval === 'auto') {
                    return { error: `${requested} already exists; call write_file again to replace it` };
                }
                await writeText(resolved.root.drive, resolved.key, String(args.content), {
                    executable: existing?.value.executable
                });
                return { written: requested, replaced: existing !== null };
            }
            catch (err) {
                return { error: errorMessage(err) };
            }
        }
    };
}
