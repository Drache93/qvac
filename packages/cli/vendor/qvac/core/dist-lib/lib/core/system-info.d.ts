import type CPUInfo from 'bare-cpu-info';
import type { Drivers, GPU, Usage as GpuUsage } from 'bare-gpu-info';
import type { LoggerInterface } from '@qvac/logging';
export type CpuQuery = ReturnType<CPUInfo['query']>;
export type CpuUsage = ReturnType<CPUInfo['sample']>;
export type CpuDiagnostics = CpuQuery & {
    readonly usage: CpuUsage;
};
export type GpuDeviceDiagnostics = GPU & {
    readonly usage: GpuUsage;
};
export interface GpuDiagnostics {
    readonly drivers: Drivers;
    readonly devices: ReadonlyArray<GpuDeviceDiagnostics>;
}
export interface SystemInfoSnapshot {
    readonly cpu: CpuDiagnostics | null;
    readonly gpu: GpuDiagnostics | null;
}
export interface SystemInfoSampler {
    snapshot(): SystemInfoSnapshot;
    destroy(): void;
}
export declare function createSystemInfoSampler(log: LoggerInterface | null): SystemInfoSampler;
