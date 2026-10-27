import b4a from 'b4a';
import { spawn } from 'child_process';
import os from 'os';
import { readSystemStats } from '#hw-gpu-stats';
const FLAG = '--gpu-probe';
const TIMEOUT_MS = 5000;
let relaunchable = false;
export function runGpuProbeIfRequested() {
    relaunchable = true;
    if (!Bare.argv.includes(FLAG)) {
        return;
    }
    console.log(JSON.stringify(readSystemStats()));
    queueMicrotask(() => Bare.exit(0));
}
export function parseGpuProbeOutput(output) {
    const line = output.trim().split('\n').at(-1) ?? '';
    if (line.length === 0) {
        return null;
    }
    try {
        const parsed = JSON.parse(line);
        return typeof parsed === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
export function spawnGpuProbe(entry = Bare.argv[1]) {
    return new Promise((resolve) => {
        const child = spawn(Bare.argv[0], [entry, FLAG], {
            stdio: ['ignore', 'pipe', 'pipe', 'pipe']
        });
        let output = '';
        const timer = setTimeout(() => {
            child.kill();
            resolve({ ok: false, stats: null });
        }, TIMEOUT_MS);
        child.stdout?.on('data', (chunk) => {
            output += b4a.toString(chunk);
        });
        child.stderr?.on('data', () => { });
        child.on('error', () => {
            clearTimeout(timer);
            resolve({ ok: false, stats: null });
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            resolve(code === 0 ? { ok: true, stats: parseGpuProbeOutput(output) } : { ok: false, stats: null });
        });
    });
}
export async function probeGpuStats() {
    if (typeof Bare !== 'undefined' && Bare.argv.includes(FLAG)) {
        return null;
    }
    const platform = os.platform();
    if (typeof Bare === 'undefined' || (platform !== 'linux' && platform !== 'win32')) {
        return readSystemStats();
    }
    if (!relaunchable) {
        return null;
    }
    return (await spawnGpuProbe()).stats;
}
