import fs from 'fs';
import { errorMessage } from '../../guards.js';
import { defaultRealpath } from '../fs/scope.js';
import { localPathOf, resolveRooted, rootedArgs, rootedLabel, stringArg } from '../fs/tool-path.js';
export function createMakeDirTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'make_dir',
        toolset: 'files',
        description: 'Create a folder (and any missing parents) inside the shared folder.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Folder path, relative to the shared folder' }
            },
            required: ['path']
        },
        effect: () => 'read',
        writeRootsRequired: true,
        validate: (args) => (stringArg(args, 'path') ? null : 'path is required'),
        paths: (args, ctx) => rootedArgs(args, ctx, ['path']),
        resource: (args, ctx) => ({
            kind: 'file',
            label: rootedLabel('mkdir', { grants: ctx, paths: [String(args.path)] })
        }),
        async execute(args, ctx) {
            const resolved = await resolveRooted(String(args.path), {
                grants: ctx,
                write: true,
                realpath,
                deniedRoots
            });
            if ('error' in resolved) {
                return resolved;
            }
            const target = localPathOf(resolved);
            if (!target) {
                return { error: 'folders can only be created in a folder on this device' };
            }
            try {
                await fs.promises.mkdir(target, { recursive: true });
                return { created: String(args.path) };
            }
            catch (err) {
                return { error: errorMessage(err) };
            }
        }
    };
}
