export type GpuClassification = 'discrete' | 'integrated' | 'software';
export declare function classifyGpu(name: string): GpuClassification;
