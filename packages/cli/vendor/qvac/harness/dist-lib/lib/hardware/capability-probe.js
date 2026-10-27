import process from 'process';
import { capabilityProfileToModelName, isMobilePlatform } from '../models/model-catalog.js';
import { probeWithAddon } from './gpu-probe-addon.js';
import { mobileBudget, parseNvidiaSmiOutput, parseRocmSmiOutput, parseWindowsRegistryOutput, sharedRamBudget } from './parsers.js';
const GIB = 1024 * 1024 * 1024;
const WINDOWS_REGISTRY_QUERY = "(Get-ItemProperty 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -Name 'HardwareInformation.qwMemorySize' -ErrorAction SilentlyContinue).'HardwareInformation.qwMemorySize' | Sort-Object -Descending | Select-Object -First 1";
const SYSFS_VRAM_PATHS = [
    '/sys/class/drm/card0/device/mem_info_vram_total',
    '/sys/class/drm/card1/device/mem_info_vram_total'
];
function pickTier(availableBytes) {
    if (availableBytes >= 48 * GIB)
        return 'xhigh';
    if (availableBytes >= 30 * GIB)
        return 'high';
    if (availableBytes >= 8 * GIB) {
        return 'mid';
    }
    return 'low';
}
function tierProfile(budget) {
    if (budget.source === 'mobile' || budget.source === 'software' || budget.source === 'no-gpu') {
        return 'low';
    }
    return pickTier(budget.availableBytes);
}
function recommend(budget) {
    const profile = tierProfile(budget);
    return {
        capabilityProfile: profile,
        recommendedModelName: capabilityProfileToModelName(profile),
        memoryBudget: {
            ...budget,
            totalBytes: Math.floor(budget.totalBytes),
            availableBytes: Math.floor(budget.availableBytes)
        }
    };
}
async function probeSysfs(reads) {
    for (const path of SYSFS_VRAM_PATHS) {
        const raw = await reads.readFile(path);
        if (!raw) {
            continue;
        }
        const bytes = Number.parseInt(raw.trim(), 10);
        if (!Number.isNaN(bytes) && bytes > 0) {
            return { totalBytes: bytes, availableBytes: bytes, source: 'vram' };
        }
    }
    return null;
}
async function probeDesktop(reads) {
    const ram = reads.totalmem();
    const addon = probeWithAddon(await reads.readGpuStats(), ram);
    if (addon && addon.source === 'vram') {
        return addon;
    }
    const nvidia = await reads.run('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
    const nvidiaBudget = nvidia ? parseNvidiaSmiOutput(nvidia) : null;
    if (nvidiaBudget) {
        return nvidiaBudget;
    }
    const rocm = await reads.run('rocm-smi --showmeminfo vram');
    const rocmBudget = rocm ? parseRocmSmiOutput(rocm) : null;
    if (rocmBudget) {
        return rocmBudget;
    }
    const sysfs = await probeSysfs(reads);
    if (sysfs) {
        return sysfs;
    }
    const registry = await reads.run(`powershell -Command "${WINDOWS_REGISTRY_QUERY}"`);
    const registryBudget = registry ? parseWindowsRegistryOutput(registry, ram) : null;
    if (registryBudget) {
        return registryBudget;
    }
    if (addon) {
        return addon;
    }
    return { ...sharedRamBudget(ram), source: 'no-gpu' };
}
async function isPixel(reads) {
    const out = await reads.run('getprop ro.product.brand');
    return out?.trim().toLowerCase() === 'google';
}
async function probeMemoryBudget(reads) {
    const os = reads.platform();
    if (isMobilePlatform(os)) {
        return mobileBudget(reads.totalmem(), await isPixel(reads));
    }
    if (os === 'darwin') {
        return sharedRamBudget(reads.totalmem());
    }
    return probeDesktop(reads);
}
function forcedProfile() {
    if (process.env['QVAC_WORKBENCH_E2E'] === '1')
        return 'mid';
    if (process.env['QVAC_WORKBENCH_FORCE_TINY_MODEL'] === '1')
        return 'tiny';
    return undefined;
}
export async function probeCapabilityProfile(reads) {
    const mobile = isMobilePlatform(reads.platform());
    const forced = forcedProfile();
    if (forced) {
        return {
            capabilityProfile: forced,
            recommendedModelName: capabilityProfileToModelName(forced),
            mobile
        };
    }
    return { ...recommend(await probeMemoryBudget(reads)), mobile };
}
