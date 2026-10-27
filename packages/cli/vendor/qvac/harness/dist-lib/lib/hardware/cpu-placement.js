import fs from 'fs';
import { platform } from 'os';
const CPU_ROOT = '/sys/devices/system/cpu';
function readSysFile(path) {
    try {
        return String(fs.readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
function cpuRange(part) {
    const [from, to = from] = part.split('-').map(Number);
    if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
        return null;
    }
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
export function parseCpuList(list) {
    const ranges = list.trim().split(',').map(cpuRange);
    return ranges.some((range) => range === null) ? [] : ranges.flat().filter((cpu) => cpu !== null);
}
function readCores(read, possible) {
    return parseCpuList(possible).flatMap((cpu) => {
        const maxFreq = Number(read(`${CPU_ROOT}/cpu${cpu}/cpufreq/cpuinfo_max_freq`)?.trim());
        return Number.isFinite(maxFreq) && maxFreq > 0 ? [{ cpu, maxFreq }] : [];
    });
}
function placementOf(cores) {
    const slowest = Math.min(...cores.map((core) => core.maxFreq));
    const fast = cores.filter((core) => core.maxFreq > slowest);
    if (fast.length === 0) {
        return undefined;
    }
    const mask = fast.reduce((bits, core) => bits | (1n << BigInt(core.cpu)), 0n);
    return { threads: fast.length, mask: mask.toString(16) };
}
export function performanceCorePlacement(read = readSysFile, hostPlatform = platform()) {
    if (hostPlatform !== 'android')
        return undefined;
    const possible = read(`${CPU_ROOT}/possible`);
    return possible === null ? undefined : placementOf(readCores(read, possible));
}
let cached = null;
export function androidCpuPlacement() {
    cached ??= { placement: performanceCorePlacement() };
    return cached.placement;
}
