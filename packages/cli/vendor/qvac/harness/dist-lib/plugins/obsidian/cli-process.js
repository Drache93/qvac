import fs from 'fs';
import path from 'path';
import process from 'process';
import { execEnv } from '../../lib/helpers/spawn-path.js';
import { expandObsidianPath, firstExistingPath, OBSIDIAN_BIN_CANDIDATES } from './readiness.js';
const RUNNING_CHECK_MS = 3_000;
export function runningCheckCommand(os) {
    if (os === 'win32') {
        return 'tasklist /FI "IMAGENAME eq Obsidian.exe" /NH | find /I "Obsidian.exe"';
    }
    return 'pgrep -x Obsidian || pgrep -i obsidian';
}
export function launchCommand(os) {
    if (os === 'darwin')
        return 'open -a Obsidian';
    if (os === 'win32')
        return 'start "" obsidian';
    return 'obsidian >/dev/null 2>&1 &';
}
export function obsidianPathEnv(platform = process.platform, env = process.env, probe = {}) {
    const expand = probe.expand ?? ((candidate) => expandObsidianPath(candidate, env));
    const exists = probe.exists ?? ((candidate) => fs.existsSync(candidate));
    const bin = firstExistingPath(OBSIDIAN_BIN_CANDIDATES[platform] ?? [], expand, exists);
    if (!bin) {
        return undefined;
    }
    const binDir = path.dirname(bin);
    const scrubbed = execEnv(env, platform);
    const prev = scrubbed.PATH ?? '';
    return { ...scrubbed, PATH: prev ? `${binDir}${path.delimiter}${prev}` : binDir };
}
export function isObsidianRunning(spawn, { killProcess, signal, platform = process.platform } = {}) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve(false);
            return;
        }
        const child = spawn(runningCheckCommand(platform), { shell: true });
        let settled = false;
        const finish = (running) => {
            if (settled)
                return;
            settled = true;
            globalThis.clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            try {
                if (child.pid !== undefined && killProcess) {
                    killProcess(-child.pid, 'SIGKILL');
                }
                else {
                    child.kill('SIGKILL');
                }
            }
            catch {
                child.kill('SIGKILL');
            }
            resolve(running);
        };
        const timer = globalThis.setTimeout(() => finish(false), RUNNING_CHECK_MS);
        const onAbort = () => finish(false);
        signal?.addEventListener('abort', onAbort, { once: true });
        child.on('exit', (code) => finish(code === 0));
        child.on('error', () => finish(false));
    });
}
export function launchObsidianApp(spawn, platform = process.platform) {
    try {
        const env = obsidianPathEnv(platform);
        const child = spawn(launchCommand(platform), {
            shell: true,
            env
        });
        child.on('error', () => { });
    }
    catch {
    }
}
