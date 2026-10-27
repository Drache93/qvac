import fs from 'fs';
import path from 'path';
import { errorMessage } from '../../guards.js';
import { defaultRealpath } from '../fs/scope.js';
import { localPathOf, resolveRooted, rootedArgs, rootedLabel, stringArg } from '../fs/tool-path.js';
export const TRASH_DIR = '.trash';
export function createTrashFileTool({ realpath = defaultRealpath, deniedRoots } = {}) {
    return {
        name: 'trash_file',
        toolset: 'files',
        description: `Move a file or folder to the shared folder's ${TRASH_DIR} folder, where the user can restore it. ` +
            'Nothing is deleted permanently. Asks the user first.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to trash, relative to the shared folder' }
            },
            required: ['path']
        },
        effect: () => 'write',
        autoApprove: false,
        writeRootsRequired: true,
        validate: (args) => (stringArg(args, 'path') ? null : 'path is required'),
        paths: (args, ctx) => rootedArgs(args, ctx, ['path']),
        resource: (args, ctx) => ({
            kind: 'file',
            label: rootedLabel('trash', { grants: ctx, paths: [String(args.path)] })
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
            const source = localPathOf(resolved);
            if (!source || resolved.root.kind !== 'local') {
                return { error: 'trash works only in a folder on this device' };
            }
            if (resolved.key === '/') {
                return { error: 'the shared folder itself cannot be trashed' };
            }
            try {
                if (!fs.existsSync(source)) {
                    return { error: `no such file: ${requested}` };
                }
                const bin = path.join(resolved.root.root, TRASH_DIR);
                const name = `${Date.now().toString(36)}-${path.basename(source)}`;
                await fs.promises.mkdir(bin, { recursive: true });
                await fs.promises.rename(source, path.join(bin, name));
                return { trashed: requested, restorableAt: `${TRASH_DIR}/${name}` };
            }
            catch (err) {
                return { error: errorMessage(err) };
            }
        }
    };
}
