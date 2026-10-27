export type EmbedDevice = 'gpu' | 'cpu';
export interface EmbedConfigInput {
    device?: EmbedDevice;
    gpuLayers?: number;
    batchSize?: number;
}
export interface EmbedConfig {
    readonly device: EmbedDevice;
    readonly gpuLayers?: number | undefined;
    readonly batchSize: number;
}
export declare const DEFAULT_EMBED_BATCH_SIZE = 1024;
export declare function createEmbedConfig(input?: EmbedConfigInput): EmbedConfig;
export declare function assertEmbedDevice(device: unknown): asserts device is EmbedDevice;
