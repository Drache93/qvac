import b4a from 'b4a';
import { errorMessage } from '../../guards.js';
import { HarnessLog } from '../../log.js';
import { pushQueue } from '../../queue.js';
import { IgnoreRules } from './ignore.js';
import { displayPath } from './scope.js';
export const WALK_SKIP_DIRS = new Set(['.git', 'node_modules', '.trash']);
const HIDDEN_DIRS = new Set(['.hg', '.svn', '.venv', '.cache', '.next']);
const IGNORE_FILES = ['.gitignore', '.ignore'];
export const MAX_WALK_ENTRIES = 10_000;
export const MAX_WALK_MS = 30_000;
function childKey(dir, name) {
    return dir === '/' ? `/${name}` : `${dir}/${name}`;
}
function isIgnoreFile(child, key) {
    return !('dir' in child) && child.value.linkname === null && child.key === key;
}
class Walk {
    skippedLinks = 0;
    kept = 0;
    #root;
    #onFile;
    #includeIgnored;
    #maxEntries;
    #deadline;
    constructor(root, onFile, { includeIgnored = false, maxEntries = MAX_WALK_ENTRIES, maxMs = MAX_WALK_MS }) {
        this.#root = root;
        this.#onFile = onFile;
        this.#includeIgnored = includeIgnored;
        this.#maxEntries = maxEntries;
        this.#deadline = Date.now() + maxMs;
    }
    async #withIgnoreFile(rules, key) {
        const bytes = await this.#root.drive.get(key);
        const dir = key.slice(0, key.lastIndexOf('/'));
        return bytes === null ? rules : rules.add(dir.slice(1), b4a.toString(bytes, 'utf8'));
    }
    async rootRules(folder) {
        let rules = new IgnoreRules();
        if (this.#includeIgnored) {
            return rules;
        }
        const parts = folder.split('/').filter(Boolean);
        for (let depth = 0; depth < parts.length; depth++) {
            const dir = '/' + parts.slice(0, depth).join('/');
            for (const name of IGNORE_FILES) {
                rules = await this.#withIgnoreFile(rules, childKey(dir, name));
            }
        }
        return rules;
    }
    async #list(dir) {
        const children = [];
        const listing = this.#root.drive.list(dir, { skip: WALK_SKIP_DIRS, recursive: false });
        for await (const child of listing) {
            if (Date.now() > this.#deadline)
                return null;
            children.push(child);
        }
        return children;
    }
    #keeps(child, rules) {
        if (this.#includeIgnored)
            return true;
        const isDir = 'dir' in child;
        const name = child.key.slice(child.key.lastIndexOf('/') + 1);
        return !(isDir && HIDDEN_DIRS.has(name)) && !rules.ignored(child.key.slice(1), isDir);
    }
    async #rulesFor(dir, children, inherited) {
        let rules = inherited;
        for (const name of IGNORE_FILES) {
            const key = childKey(dir, name);
            if (!this.#includeIgnored && children.some((child) => isIgnoreFile(child, key))) {
                rules = await this.#withIgnoreFile(rules, key);
            }
        }
        return rules;
    }
    async visit(dir, inherited) {
        const children = await this.#list(dir);
        if (children === null) {
            return false;
        }
        const rules = await this.#rulesFor(dir, children, inherited);
        for (const child of children) {
            if (!this.#keeps(child, rules))
                continue;
            if (++this.kept > this.#maxEntries || Date.now() > this.#deadline) {
                return false;
            }
            if ('dir' in child) {
                if (!(await this.visit(child.key, rules))) {
                    return false;
                }
            }
            else if (child.value.linkname !== null) {
                this.skippedLinks++;
            }
            else {
                this.#onFile({
                    path: displayPath(this.#root, child.key),
                    key: child.key,
                    byteLength: child.value.blob?.byteLength ?? 0
                });
            }
        }
        return true;
    }
}
async function run(walk, root, folder) {
    try {
        const complete = await walk.visit(folder, await walk.rootRules(folder));
        return { truncated: !complete, skippedLinks: walk.skippedLinks };
    }
    catch (err) {
        HarnessLog.warn('warn: walk aborted mid-listing', {
            root: displayPath(root, '/'),
            folder,
            kept: walk.kept,
            err: errorMessage(err)
        });
        return { truncated: true, skippedLinks: walk.skippedLinks };
    }
}
export async function walkFiles(root, folder = '/', opts = {}) {
    const files = [];
    const summary = await run(new Walk(root, (file) => files.push(file), opts), root, folder);
    return { files, ...summary };
}
export function streamFiles(root, folder = '/', opts = {}) {
    const queue = pushQueue();
    const result = run(new Walk(root, (file) => void queue.push(file), opts), root, folder);
    void result.then(() => queue.end());
    return { files: queue, result };
}
