import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
import { HarnessError } from '../../errors.js';
import { userTmpPath } from '../../tmp-path.js';
import { hashBundledSkills } from './bundled-hash.js';
import { SKILLS as BUNDLED_SKILLS } from '@qvac/skills/bundled';
import { SKILLS_HASH as BUNDLED_SKILLS_HASH } from '@qvac/skills/hash';
let inflight = null;
export function ensureBundledSkillsDir() {
    inflight ??= materialize().finally(() => {
        inflight = null;
    });
    return inflight;
}
async function materialize() {
    const dir = userTmpPath('qvac-harness-skills-' + BUNDLED_SKILLS_HASH);
    if (await validTree(dir)) {
        return dir;
    }
    const staging = `${dir}-staging-${process.pid}-${randomSuffix()}`;
    await fs.promises.mkdir(staging, { recursive: true });
    if (os.platform() !== 'win32') {
        await fs.promises.chmod(staging, 0o700);
    }
    try {
        await writeTree(staging);
        if (!(await validTree(staging))) {
            throw new HarnessError('BUNDLED_SKILLS_INVALID', [staging]);
        }
        if (await tryRename(staging, dir)) {
            return dir;
        }
        if (await validTree(dir)) {
            return dir;
        }
        const trash = `${dir}.trash-${process.pid}-${randomSuffix()}`;
        try {
            await fs.promises.rename(dir, trash);
        }
        catch (err) {
            if (await validTree(dir)) {
                return dir;
            }
            throw occupiedError(dir, err);
        }
        void fs.promises.rm(trash, { recursive: true, force: true });
        if (await tryRename(staging, dir)) {
            return dir;
        }
        if (await validTree(dir)) {
            return dir;
        }
        throw tamperError(dir);
    }
    finally {
        await fs.promises.rm(staging, { recursive: true, force: true });
    }
}
function tamperError(dir) {
    return new HarnessError('BUNDLED_SKILLS_TAMPERED', [dir]);
}
function occupiedError(dir, cause) {
    const why = cause instanceof Error ? ` (${cause.message})` : '';
    return new HarnessError('BUNDLED_SKILLS_OCCUPIED', [dir, why]);
}
export function randomSuffix() {
    return Math.random().toString(36).slice(2, 10);
}
async function tryRename(from, to) {
    try {
        await fs.promises.rename(from, to);
        return true;
    }
    catch {
        return false;
    }
}
async function writeTree(dir) {
    for (const [relPath, content] of Object.entries(BUNDLED_SKILLS)) {
        const target = path.join(dir, relPath);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, content);
    }
}
async function validTree(dir) {
    try {
        if (os.platform() !== 'win32') {
            const stat = await fs.promises.lstat(dir);
            if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) {
                return false;
            }
        }
        const files = await collect(dir, '');
        if (files === null) {
            return false;
        }
        return hashBundledSkills(files) === BUNDLED_SKILLS_HASH;
    }
    catch {
        return false;
    }
}
async function collect(dir, prefix) {
    const files = [];
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            const nested = await collect(path.join(dir, entry.name), rel);
            if (nested === null) {
                return null;
            }
            files.push(...nested);
        }
        else if (entry.isFile()) {
            files.push({
                path: rel,
                content: await fs.promises.readFile(path.join(dir, entry.name), 'utf8')
            });
        }
        else {
            return null;
        }
    }
    return files;
}
