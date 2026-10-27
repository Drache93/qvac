export declare const MAX_IMAGE_WIDTH = 768;
export declare const IMAGE_MIMES: Set<string>;
export declare function normalizeImageForModel(bytes: Uint8Array): Promise<Uint8Array>;
export interface Raster {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
}
export declare function rasterToModelJpeg(raster: Raster): Promise<Uint8Array | null>;
