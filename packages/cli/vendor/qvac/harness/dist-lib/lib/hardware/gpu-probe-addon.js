import { z } from 'zod';
import { classifyGpu } from './gpu-classify.js';
import { IGPU_LIE_THRESHOLD, sharedRamBudget } from './parsers.js';
const GpuDeviceSchema = z.object({
    name: z.string(),
    videoMemoryBytes: z.number()
});
const StatsSchema = z.object({
    memory: z.object({ totalBytes: z.number() }).optional(),
    gpu: z.object({ devices: z.array(GpuDeviceSchema) }).optional()
});
function classifyBestDevice(devices, systemRamBytes) {
    for (const device of devices) {
        const cls = classifyGpu(device.name);
        if (cls === 'software') {
            continue;
        }
        if (cls === 'discrete') {
            const vram = device.videoMemoryBytes;
            if (vram > systemRamBytes * IGPU_LIE_THRESHOLD) {
                return { ...sharedRamBudget(systemRamBytes), source: 'integrated', gpuClass: 'integrated' };
            }
            return { totalBytes: vram, availableBytes: vram, source: 'vram', gpuClass: 'discrete' };
        }
    }
    return null;
}
export function probeWithAddon(rawStats, systemRamBytes) {
    const parsed = StatsSchema.safeParse(rawStats);
    if (!parsed.success) {
        return null;
    }
    const devices = parsed.data.gpu?.devices ?? [];
    if (devices.length === 0) {
        return null;
    }
    const totalRamBytes = parsed.data.memory?.totalBytes ?? systemRamBytes;
    const best = classifyBestDevice(devices, totalRamBytes);
    if (best) {
        return best;
    }
    if (devices.every((device) => classifyGpu(device.name) === 'software')) {
        return { ...sharedRamBudget(totalRamBytes), source: 'software' };
    }
    return { ...sharedRamBudget(totalRamBytes), source: 'integrated', gpuClass: 'integrated' };
}
