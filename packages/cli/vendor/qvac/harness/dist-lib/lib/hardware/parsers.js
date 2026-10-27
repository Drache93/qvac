const GIB = 1024 * 1024 * 1024;
const SHARED_RAM_RESERVE_BYTES = 3 * GIB;
const SHARED_RAM_FRACTION = 0.8;
const MOBILE_FRACTION = 0.6;
const MOBILE_PIXEL_FRACTION = 0.4;
export const IGPU_LIE_THRESHOLD = 0.9;
export function parseNvidiaSmiOutput(stdout) {
    const firstLine = stdout.split('\n')[0] ?? '';
    const mib = Number.parseInt(firstLine, 10);
    if (Number.isNaN(mib) || mib <= 0) {
        return null;
    }
    const bytes = mib * 1024 * 1024;
    return { totalBytes: bytes, availableBytes: bytes, source: 'vram', gpuClass: 'discrete' };
}
export function parseRocmSmiOutput(stdout) {
    const match = /Total.*?:\s*(\d+)/i.exec(stdout);
    if (!match) {
        return null;
    }
    const bytes = Number.parseInt(match[1] ?? '', 10);
    if (Number.isNaN(bytes) || bytes <= 0) {
        return null;
    }
    return { totalBytes: bytes, availableBytes: bytes, source: 'vram' };
}
export function parseWindowsRegistryOutput(stdout, systemRamBytes) {
    const firstLine = stdout.split('\n')[0] ?? '';
    const bytes = Number.parseInt(firstLine, 10);
    if (Number.isNaN(bytes) || bytes <= 0) {
        return null;
    }
    if (bytes > systemRamBytes * IGPU_LIE_THRESHOLD) {
        return { ...sharedRamBudget(systemRamBytes), source: 'integrated' };
    }
    return { totalBytes: bytes, availableBytes: bytes, source: 'vram' };
}
export function sharedRamBudget(ramBytes) {
    const available = Math.min(ramBytes * SHARED_RAM_FRACTION, ramBytes - SHARED_RAM_RESERVE_BYTES);
    return { totalBytes: ramBytes, availableBytes: Math.max(available, 0), source: 'shared' };
}
export function mobileBudget(ramBytes, isPixel) {
    const fraction = isPixel ? MOBILE_PIXEL_FRACTION : MOBILE_FRACTION;
    return { totalBytes: ramBytes, availableBytes: ramBytes * fraction, source: 'mobile' };
}
