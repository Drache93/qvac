export interface GpuProbeResult {
    readonly ok: boolean;
    readonly stats: unknown;
}
export declare function runGpuProbeIfRequested(): void;
export declare function parseGpuProbeOutput(output: string): unknown;
export declare function spawnGpuProbe(entry?: string): Promise<GpuProbeResult>;
export declare function probeGpuStats(): Promise<unknown>;
