import { platform } from 'os';
export function adrenoSafeKvCache(device, { k, v }, hostPlatform = platform()) {
    if (device === 'cpu' || hostPlatform !== 'android') {
        return { k, v };
    }
    return { k: 'f16', v: 'f16' };
}
