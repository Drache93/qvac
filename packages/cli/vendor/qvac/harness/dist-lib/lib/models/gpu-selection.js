import { promises } from 'fs';
import { platform } from 'os';
let cachedDedicated = null;
export async function resolveMainGpu() {
    if (platform() !== 'linux')
        return undefined;
    if (cachedDedicated !== null)
        return cachedDedicated;
    if (await hasNvidiaGpu()) {
        cachedDedicated = 'dedicated';
        return cachedDedicated;
    }
    return undefined;
}
export function resetMainGpuCache() {
    cachedDedicated = null;
}
async function hasNvidiaGpu() {
    try {
        const entries = await promises.readdir('/proc/driver/nvidia/gpus');
        return entries.length > 0;
    }
    catch {
        return false;
    }
}
