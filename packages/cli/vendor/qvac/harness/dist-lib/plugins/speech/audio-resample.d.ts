interface WavFormat {
    readonly formatCode: number;
    readonly channels: number;
    readonly sampleRate: number;
    readonly bitsPerSample: number;
}
export declare function wavFormat(bytes: Uint8Array): WavFormat | null;
export declare function needsResample(bytes: Uint8Array): boolean;
export interface ResampledAudio {
    readonly bytes: Uint8Array;
    readonly transcoded: boolean;
}
export declare function resampleForTranscription(bytes: Uint8Array): Promise<ResampledAudio>;
export declare function pcmForTranscription(bytes: Uint8Array): AsyncGenerator<Uint8Array>;
export {};
