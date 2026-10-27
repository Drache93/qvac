import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
const SDK_CONFIG_PATH_ENV = 'QVAC_CONFIG_PATH';
const OVERLAY_DIR_NAME = 'skills';
export function resolveSkillsOverlayDir(env = process.env) {
    const configPath = env[SDK_CONFIG_PATH_ENV];
    if (!configPath) {
        return null;
    }
    return path.join(path.dirname(configPath), OVERLAY_DIR_NAME);
}
export function ensureSkillsOverlayDir(env = process.env) {
    const dir = resolveSkillsOverlayDir(env);
    return dir ? materialize(dir) : Promise.resolve(null);
}
async function materialize(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
    if (os.platform() !== 'win32') {
        await fs.promises.chmod(dir, 0o700);
    }
    return dir;
}
