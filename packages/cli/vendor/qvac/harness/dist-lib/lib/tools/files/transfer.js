import fs from 'fs';
import path from 'path';
import { errorMessage } from '../../guards.js';
import { defaultRealpath } from '../fs/scope.js';
import { localPathOf, resolveRooted, rootedArgs, rootedLabel, stringArg } from '../fs/tool-path.js';
function fromTo(from) {
    return {
        type: 'object',
        properties: {
            from: { type: 'string', description: from },
            to: { type: 'string', description: 'New path, relative to the shared folder' }
        },
        required: ['from', 'to']
    };
}
export function createMoveFileTool(options = {}) {
    return {
        ...transferTool({ ...options, copy: false }),
        name: 'move_file',
        parameters: fromTo('Current path, relative to the shared folder'),
        description: 'Move or rename a file or folder inside the shared folder. Fails if the destination exists. ' +
            'Asks the user first.',
        effect: () => 'write',
        autoApprove: false
    };
}
export function createCopyFileTool(options = {}) {
    return {
        ...transferTool({ ...options, copy: true }),
        name: 'copy_file',
        parameters: fromTo('File to copy, relative to the shared folder'),
        description: 'Copy a file inside the shared folder to a new path. Fails if the destination exists.',
        effect: () => 'read'
    };
}
function transferTool({ realpath = defaultRealpath, deniedRoots, copy }) {
    return {
        toolset: 'files',
        writeRootsRequired: true,
        validate: (args) => stringArg(args, 'from') && stringArg(args, 'to') ? null : 'from and to are required',
        paths: (args, ctx) => rootedArgs(args, ctx, ['from', 'to']),
        resource: (args, ctx) => ({
            kind: 'file',
            label: rootedLabel(copy ? 'copy' : 'move', {
                grants: ctx,
                paths: [String(args.from), String(args.to)]
            })
        }),
        execute: (args, ctx) => transfer(args, ctx, { realpath, deniedRoots, copy })
    };
}
async function transfer(args, ctx, { realpath = defaultRealpath, deniedRoots, copy }) {
    const scope = { grants: ctx, write: true, realpath, deniedRoots };
    const from = await resolveRooted(String(args.from), scope);
    if ('error' in from) {
        return from;
    }
    const to = await resolveRooted(String(args.to), scope);
    if ('error' in to) {
        return to;
    }
    const source = localPathOf(from);
    const target = localPathOf(to);
    if (!source || !target) {
        return { error: 'moving and copying work only in a folder on this device' };
    }
    try {
        if (!fs.existsSync(source)) {
            return { error: `no such file: ${String(args.from)}` };
        }
        if (fs.existsSync(target)) {
            return { error: `${String(args.to)} already exists` };
        }
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await (copy ? fs.promises.copyFile(source, target) : fs.promises.rename(source, target));
        return copy
            ? { copied: String(args.from), to: String(args.to) }
            : { moved: String(args.from), to: String(args.to) };
    }
    catch (err) {
        return { error: errorMessage(err) };
    }
}
