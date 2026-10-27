import fs from 'fs';
import path from 'path';
import ScopeLock from 'scope-lock';
import { CoreError } from '../errors.js';
import { fsGrantKey, fsWriteGrantKey } from '../fs-grant-keys.js';
import { fsGrantsFrom, grantedDirsFrom } from '../fs-grants.js';
export class AgentFolders {
    _state;
    _storageRoot;
    _lock = new ScopeLock();
    constructor(state, { storageRoot }) {
        this._state = state;
        this._storageRoot = storageRoot;
    }
    async list({ agentId }) {
        return { agentId, folders: foldersOf(await this._read(agentId)) };
    }
    async add({ agentId, path: given, access }) {
        const folder = await this._shareable(given);
        return this._update(agentId, ({ roots, writable }) => ({
            roots: localPathsOf(roots).includes(folder)
                ? roots
                : [...roots, { kind: 'local', path: folder }],
            writable: access === 'write' ? withDir(writable, folder) : withoutDir(writable, folder)
        }));
    }
    async remove({ agentId, path: given }) {
        const names = await namesOf(given);
        return this._update(agentId, (grants) => {
            if (!foldersOf(grants).some((folder) => names.includes(folder.path))) {
                throw new CoreError('AGENT_FOLDER_NOT_SHARED', [given]);
            }
            return {
                roots: grants.roots.filter((root) => !names.includes(localPathOf(root) ?? '')),
                writable: names.reduce(withoutDir, grants.writable)
            };
        });
    }
    async forget(agentId) {
        await this._lock.lock();
        try {
            await this._state.deleteAll([fsGrantKey(agentId), fsWriteGrantKey(agentId)]);
        }
        finally {
            this._lock.unlock();
        }
    }
    async _read(agentId) {
        const [roots, writable] = await Promise.all([
            this._state.get(fsGrantKey(agentId)),
            this._state.get(fsWriteGrantKey(agentId))
        ]);
        return { roots: Array.isArray(roots) ? roots : [], writable: grantedDirsFrom(writable) };
    }
    async _update(agentId, change) {
        await this._lock.lock();
        try {
            const next = change(await this._read(agentId));
            await this._state.setAll([
                { key: fsGrantKey(agentId), value: next.roots },
                { key: fsWriteGrantKey(agentId), value: next.writable }
            ]);
            return { agentId, folders: foldersOf(next) };
        }
        finally {
            this._lock.unlock();
        }
    }
    async _shareable(given) {
        if (!path.isAbsolute(given)) {
            throw new CoreError('AGENT_FOLDER_NOT_ABSOLUTE', [given]);
        }
        const folder = await fs.promises.realpath(given).catch(() => null);
        if (!folder) {
            throw new CoreError('AGENT_FOLDER_MISSING', [given]);
        }
        if (!(await fs.promises.stat(folder)).isDirectory()) {
            throw new CoreError('AGENT_FOLDER_IS_FILE', [given]);
        }
        const storage = await fs.promises.realpath(this._storageRoot);
        if (folder === storage || folder.startsWith(storage + path.sep)) {
            throw new CoreError('AGENT_FOLDER_IN_STORAGE', [given]);
        }
        return folder;
    }
}
export function createAgentFoldersApi(folders) {
    return {
        listAgentFolders: (request) => folders.list(request),
        addAgentFolder: (request) => folders.add(request),
        removeAgentFolder: (request) => folders.remove(request)
    };
}
async function namesOf(given) {
    const resolved = path.resolve(given);
    const real = await fs.promises.realpath(resolved).catch(() => resolved);
    return [...new Set([resolved, real])];
}
function localPathOf(root) {
    const [grant] = fsGrantsFrom([root]);
    return grant?.kind === 'local' ? grant.path : null;
}
function localPathsOf(roots) {
    return roots.map(localPathOf).filter((dir) => dir !== null);
}
function withDir(dirs, dir) {
    return dirs.includes(dir) ? dirs : [...dirs, dir];
}
function withoutDir(dirs, dir) {
    return dirs.filter((other) => other !== dir);
}
function foldersOf({ roots, writable }) {
    const paths = [...new Set([...localPathsOf(roots), ...writable])];
    return paths.map((dir) => ({ path: dir, access: writable.includes(dir) ? 'write' : 'read' }));
}
