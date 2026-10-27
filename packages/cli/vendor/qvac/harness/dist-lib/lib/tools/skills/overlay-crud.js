import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../errors.js';
import { randomSuffix } from './bundled-dir.js';
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function assertSafeName(name) {
    if (!SAFE_NAME.test(name)) {
        throw new HarnessError('INVALID_SKILL_NAME', [name]);
    }
}
async function dirNames(root) {
    try {
        const entries = await fs.promises.readdir(root, { withFileTypes: true });
        return new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
    }
    catch {
        return new Set();
    }
}
async function readIfPresent(file) {
    try {
        return await fs.promises.readFile(file, 'utf8');
    }
    catch {
        return null;
    }
}
export async function listManagedSkills(baseDir, overlayDir) {
    const base = await dirNames(baseDir);
    const overlay = overlayDir ? await dirNames(overlayDir) : new Set();
    const names = [...new Set([...base, ...overlay])].sort((a, b) => a.localeCompare(b));
    return names.map((name) => {
        const inOverlay = overlay.has(name);
        return {
            name,
            origin: inOverlay ? 'overlay' : 'base',
            overridesBase: inOverlay && base.has(name)
        };
    });
}
export async function readSkillFile(baseDir, overlayDir, name) {
    assertSafeName(name);
    if (overlayDir) {
        const over = await readIfPresent(path.join(overlayDir, name, 'SKILL.md'));
        if (over !== null) {
            return { content: over, origin: 'overlay' };
        }
    }
    const base = await readIfPresent(path.join(baseDir, name, 'SKILL.md'));
    return base !== null ? { content: base, origin: 'base' } : null;
}
export async function writeSkillFile(overlayDir, name, content) {
    assertSafeName(name);
    const skillDir = path.join(overlayDir, name);
    await fs.promises.mkdir(skillDir, { recursive: true });
    const target = path.join(skillDir, 'SKILL.md');
    const tmp = `${target}.tmp-${randomSuffix()}`;
    await fs.promises.writeFile(tmp, content);
    await fs.promises.rename(tmp, target);
    return skillDir;
}
export async function copyBaseForEdit(baseDir, overlayDir, name) {
    assertSafeName(name);
    const dest = path.join(overlayDir, name);
    if (await exists(dest)) {
        return { copied: false };
    }
    const src = path.join(baseDir, name);
    if (!(await exists(src))) {
        throw new HarnessError('SKILL_NOT_FOUND', [name]);
    }
    await copyDir(src, dest);
    return { copied: true };
}
export async function deleteOverlaySkill(overlayDir, name) {
    assertSafeName(name);
    const dir = path.join(overlayDir, name);
    if (!(await exists(dir))) {
        return { removed: false };
    }
    await fs.promises.rm(dir, { recursive: true, force: true });
    return { removed: true };
}
async function exists(target) {
    try {
        await fs.promises.lstat(target);
        return true;
    }
    catch {
        return false;
    }
}
async function copyDir(src, dest) {
    await fs.promises.mkdir(dest, { recursive: true });
    for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(from, to);
        }
        else if (entry.isFile()) {
            await fs.promises.writeFile(to, await fs.promises.readFile(from));
        }
    }
}
