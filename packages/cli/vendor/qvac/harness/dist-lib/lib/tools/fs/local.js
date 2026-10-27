import fs from 'fs';
import path from 'path';
import Localdrive from 'localdrive';
import { defaultRealpath } from './scope.js';
function withSkipList(localdrive, root) {
    async function* listShallow(folder, skip) {
        const base = folder === '/' ? '' : folder.replace(/\/+$/, '');
        const dir = await fs.promises.opendir(path.join(root, base)).catch(() => null);
        if (dir === null) {
            return;
        }
        for await (const dirent of dir) {
            if (skip?.has(dirent.name))
                continue;
            const key = `${base}/${dirent.name}`;
            if (dirent.isDirectory()) {
                yield { key, dir: true };
                continue;
            }
            const entry = await localdrive.entry(key);
            if (entry) {
                yield entry;
            }
        }
    }
    return {
        entry: localdrive.entry.bind(localdrive),
        get: localdrive.get.bind(localdrive),
        list: (folder = '/', opts) => opts?.recursive === false
            ? listShallow(folder, opts.skip)
            : localdrive.list(folder, {
                ignore: (key) => key.split('/').some((segment) => opts?.skip?.has(segment))
            }),
        createReadStream: localdrive.createReadStream.bind(localdrive),
        createWriteStream: localdrive.createWriteStream.bind(localdrive)
    };
}
export async function createLocalRoots(dirs, realpath = defaultRealpath) {
    const roots = [];
    for (const dir of dirs) {
        let canonical;
        try {
            canonical = await realpath(path.resolve(dir));
        }
        catch {
            continue;
        }
        const localdrive = new Localdrive(canonical, { atomic: true });
        roots.push({ kind: 'local', root: canonical, drive: withSkipList(localdrive, canonical) });
    }
    return roots;
}
