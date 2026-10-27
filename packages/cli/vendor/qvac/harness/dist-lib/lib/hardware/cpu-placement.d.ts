export interface CpuPlacement {
    threads: number;
    mask: string;
}
export type ReadSysFile = (path: string) => string | null;
export declare function parseCpuList(list: string): number[];
export declare function performanceCorePlacement(read?: ReadSysFile, hostPlatform?: string): CpuPlacement | undefined;
export declare function androidCpuPlacement(): CpuPlacement | undefined;
