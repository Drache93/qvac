export type MainGpuProbe = () => Promise<string | undefined>;
export declare function resolveMainGpu(): Promise<string | undefined>;
export declare function resetMainGpuCache(): void;
