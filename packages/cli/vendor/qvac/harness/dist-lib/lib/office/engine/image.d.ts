export type ImageFormat = 'png' | 'jpeg' | 'gif';
export interface ImageInfo {
    format: ImageFormat;
    contentType: string;
    width: number;
    height: number;
}
export declare function probe(bytes: Uint8Array): ImageInfo;
