import type { EmbedDevice } from './embed-config.ts';
export declare function isSdkGpuDeviceLostError(err: unknown): boolean;
export declare function isSdkModelWedgedError(err: unknown): boolean;
export declare function isToolGrammarFault(err: unknown): boolean;
export declare function isForcedCallFault(err: unknown): boolean;
export declare function isKvCacheSaveFault(err: unknown): boolean;
export declare function isContextOverflowError(err: unknown): boolean;
export type GpuFaultDecision = 'reload' | 'fallback';
interface GpuFaultEscalation {
    recordFault(onGpu: boolean): GpuFaultDecision;
    reset(): void;
}
export declare function createGpuFaultEscalation(): GpuFaultEscalation;
export interface GpuFaultState {
    readonly device: EmbedDevice;
    readonly generation: number;
    gpuLayers(): number;
    key(model: string): string;
    recordFault(bornAt: number): void;
    reset(): void;
}
export interface GpuFaultStateOptions {
    device?: EmbedDevice;
    gpuLayers?: number;
}
export declare function createGpuFaultState({ device, gpuLayers }?: GpuFaultStateOptions): GpuFaultState;
export {};
