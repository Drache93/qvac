import b4a from 'b4a';
import { errorMessage } from '../../guards.js';
import { editMatch } from '../fs/edit-match.js';
import { defaultRealpath } from '../fs/scope.js';
import { resolveRooted, rootedArgs, rootedLabel, stringArg } from '../fs/tool-path.js';
import { writeText } from '../fs/write.js';
export function createEditFileTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'edit_file',
        toolset: 'files',
        description: 'Change part of a file in the shared folder: replaces the text in old with new. old must match ' +
            'one place in the file (copy it from read_file, without the line numbers); set replaceAll to ' +
            'change every match. Asks the user first.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path, relative to the shared folder' },
                old: { type: 'string', description: 'The exact text to replace' },
                new: { type: 'string', description: 'The text to put in its place' },
                replaceAll: { type: 'boolean', description: 'Replace every match instead of exactly one' }
            },
            required: ['path', 'old', 'new']
        },
        effect: () => 'write',
        autoApprove: false,
        writeRootsRequired: true,
        validate(args) {
            if (!stringArg(args, 'path'))
                return 'path is required';
            if (typeof args.old !== 'string' || !args.old) {
                return 'old must be the text to replace';
            }
            return typeof args.new === 'string' ? null : 'new must be a string';
        },
        paths: (args, ctx) => rootedArgs(args, ctx, ['path']),
        resource: (args, ctx) => ({
            kind: 'file',
            label: rootedLabel('edit', { grants: ctx, paths: [String(args.path)] })
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
                const { drive } = resolved.root;
                const entry = await drive.entry(resolved.key);
                const blob = entry === null ? null : await drive.get(resolved.key);
                if (entry === null || blob === null) {
                    return { error: `no such file: ${requested}` };
                }
                const result = editMatch(b4a.toString(blob, 'utf8'), {
                    old: String(args.old),
                    replacement: String(args.new),
                    replaceAll: args.replaceAll === true
                });
                if (result.error) {
                    return { error: result.error };
                }
                await writeText(drive, resolved.key, result.content, { executable: entry.value.executable });
                return { edited: requested, replacements: result.count };
            }
            catch (err) {
                return { error: errorMessage(err) };
            }
        }
    };
}
