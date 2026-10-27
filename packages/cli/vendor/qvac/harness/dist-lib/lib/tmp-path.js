import os from 'os';
import path from 'path';
export function userTmpPath(name, opts = {}) {
    const readOwner = opts.readOwner ?? (() => os.userInfo());
    return path.join(os.tmpdir(), taggedName(name, readOwner));
}
function taggedName(name, readOwner) {
    let owner;
    try {
        const { uid, username } = readOwner();
        owner = uid >= 0 ? `u${uid}` : username.replace(/[^A-Za-z0-9_-]/g, '');
    }
    catch {
        return name;
    }
    return owner ? `${name}-${owner}` : name;
}
