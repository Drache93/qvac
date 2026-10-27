import CPUInfoCtor from '#cpu-info';
import GPUInfoCtor from '#gpu-info';
const LOG_TAG = ['diagnostics', 'system-info'];
function readCpu(cpu, log) {
    try {
        return { ...cpu.query(), usage: cpu.sample() };
    }
    catch (err) {
        log?.warn(LOG_TAG, 'cpu sample failed', err);
        return null;
    }
}
function readGpu(gpu, log) {
    try {
        const drivers = gpu.drivers();
        const devices = [];
        for (let i = 0; i < gpu.length; i++) {
            try {
                devices.push({ ...gpu.gpu(i), usage: gpu.sample(i) });
            }
            catch (err) {
                log?.warn(LOG_TAG, `gpu device ${i} sample failed`, err);
            }
        }
        return { drivers, devices };
    }
    catch (err) {
        log?.warn(LOG_TAG, 'gpu drivers query failed', err);
        return null;
    }
}
export function createSystemInfoSampler(log) {
    let cpu = null;
    let gpu = null;
    try {
        if (CPUInfoCtor) {
            cpu = new CPUInfoCtor();
        }
    }
    catch (err) {
        log?.warn(LOG_TAG, 'bare-cpu-info constructor failed', err);
        cpu = null;
    }
    try {
        if (GPUInfoCtor) {
            gpu = new GPUInfoCtor();
        }
    }
    catch (err) {
        log?.warn(LOG_TAG, 'bare-gpu-info constructor failed', err);
        gpu = null;
    }
    return {
        snapshot() {
            return {
                cpu: cpu ? readCpu(cpu, log) : null,
                gpu: gpu ? readGpu(gpu, log) : null
            };
        },
        destroy() {
            cpu?.destroy();
            gpu?.destroy();
            cpu = null;
            gpu = null;
        }
    };
}
