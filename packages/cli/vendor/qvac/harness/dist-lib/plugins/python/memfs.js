import { errorMessage } from '../../lib/guards.js';
import { HarnessLog } from '../../lib/log.js';
import { MAX_OUTPUT_FILE_BYTES, MAX_OUTPUT_TOTAL_BYTES } from '../../lib/tools/attachments/output-policy.js';
let runCounter = 0;
function filePath(dir, name) {
    return `${dir}/${name}`;
}
export function nextScratchDir(fs) {
    let candidate = `/tmp/qvac-exec-${++runCounter}`;
    while (fs.analyzePath(candidate).exists) {
        candidate = `/tmp/qvac-exec-${++runCounter}`;
    }
    return candidate;
}
export function stageInputFiles(fs, dir, inputs) {
    fs.mkdirTree(dir);
    for (const input of inputs) {
        fs.writeFile(filePath(dir, input.path), input.bytes);
    }
}
function isRegularFile(fs, path) {
    const mode = fs.lstat(path).mode;
    return !fs.isDir(mode) && !fs.isLink(mode);
}
export function collectOutputs(fs, dir, names) {
    const files = new Map();
    const missing = [];
    const rejected = [];
    let total = 0;
    for (const name of names) {
        const path = filePath(dir, name);
        if (fs.analyzePath(path).exists && isRegularFile(fs, path)) {
            const size = fs.stat(path).size;
            if (size > MAX_OUTPUT_FILE_BYTES) {
                rejected.push({ name, reason: 'file exceeds maximum output size' });
                continue;
            }
            if (total + size > MAX_OUTPUT_TOTAL_BYTES) {
                rejected.push({ name, reason: 'outputs exceed maximum total size' });
                continue;
            }
            files.set(name, new Uint8Array(fs.readFile(path, { encoding: 'binary' })));
            total += size;
        }
        else {
            missing.push(name);
        }
    }
    return { files, missing, rejected };
}
function removeTree(fs, dir) {
    for (const name of fs.readdir(dir)) {
        if (name === '.' || name === '..')
            continue;
        const path = filePath(dir, name);
        const mode = fs.lstat(path).mode;
        if (fs.isDir(mode) && !fs.isLink(mode)) {
            removeTree(fs, path);
        }
        else {
            fs.unlink(path);
        }
    }
    fs.rmdir(dir);
}
export function removeScratch(fs, dir, previousCwd) {
    try {
        fs.chdir(previousCwd);
        removeTree(fs, dir);
    }
    catch (error) {
        HarnessLog.warn('python: scratch cleanup failed', {
            dir,
            err: errorMessage(error)
        });
    }
}
export function openScratch(fs, workdir) {
    const dir = nextScratchDir(fs);
    const cwd = workdir ? `${dir}/${workdir}` : dir;
    const previousCwd = fs.cwd();
    fs.mkdirTree(cwd);
    return {
        dir,
        cwd,
        [Symbol.dispose]() {
            removeScratch(fs, dir, previousCwd);
        }
    };
}
