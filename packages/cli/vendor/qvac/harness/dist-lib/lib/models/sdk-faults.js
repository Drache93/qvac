export function isSdkGpuDeviceLostError(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const message = 'message' in err ? err.message : undefined;
    if (typeof message !== 'string') {
        return false;
    }
    return /ErrorDeviceLost/i.test(message) || /VK_ERROR_DEVICE_LOST/i.test(message);
}
export function isSdkModelWedgedError(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const message = 'message' in err ? err.message : undefined;
    if (typeof message !== 'string') {
        return false;
    }
    return /failed to (decode next token|eval chunk)/i.test(message);
}
export function isToolGrammarFault(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const message = 'message' in err ? err.message : undefined;
    if (typeof message !== 'string') {
        return false;
    }
    return /empty grammar stack/i.test(message);
}
export function isForcedCallFault(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const message = 'message' in err ? err.message : undefined;
    if (typeof message !== 'string') {
        return false;
    }
    return /demanded a tool call/i.test(message);
}
export function isKvCacheSaveFault(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const message = 'message' in err ? err.message : undefined;
    if (typeof message !== 'string') {
        return false;
    }
    return /failed to (save session file|promote tmp file)/i.test(message);
}
export function isContextOverflowError(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    return 'name' in err && err.name === 'CONTEXT_OVERFLOW';
}
export function createGpuFaultEscalation() {
    let count = 0;
    return {
        recordFault(onGpu) {
            count += 1;
            return onGpu && count >= 2 ? 'fallback' : 'reload';
        },
        reset() {
            count = 0;
        }
    };
}
const GPU_LAYERS_FULL = 99;
const GPU_LAYERS_NONE = 0;
export function createGpuFaultState({ device, gpuLayers } = {}) {
    const escalation = createGpuFaultEscalation();
    let current = device ?? 'gpu';
    let generation = 0;
    let lastFaulted = -1;
    return {
        get device() {
            return current;
        },
        get generation() {
            return generation;
        },
        gpuLayers() {
            return gpuLayers ?? (current === 'gpu' ? GPU_LAYERS_FULL : GPU_LAYERS_NONE);
        },
        key(model) {
            return [model, current, generation].join('\0');
        },
        recordFault(bornAt) {
            if (bornAt <= lastFaulted)
                return;
            lastFaulted = bornAt;
            generation += 1;
            if (escalation.recordFault(current === 'gpu') === 'fallback') {
                current = 'cpu';
            }
        },
        reset() {
            escalation.reset();
        }
    };
}
