import type { CapabilityInfo } from '../contract-types.ts';
export interface PlatformReads {
    totalmem(): number;
    platform(): string;
    readFile(path: string): Promise<string | null>;
    run(command: string): Promise<string | null>;
    readGpuStats(): unknown | Promise<unknown>;
}
export declare function probeCapabilityProfile(reads: PlatformReads): Promise<CapabilityInfo>;
