export type MemoryBudgetSource = 'vram' | 'shared' | 'mobile' | 'integrated' | 'no-gpu' | 'software';
export type GpuClass = 'discrete' | 'integrated';
export interface MemoryBudget {
    readonly totalBytes: number;
    readonly availableBytes: number;
    readonly source: MemoryBudgetSource;
    readonly gpuClass?: GpuClass;
}
