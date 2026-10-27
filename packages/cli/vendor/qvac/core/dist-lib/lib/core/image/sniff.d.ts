export type SniffedImageMime = 'image/png' | 'image/jpeg' | 'image/heic' | 'image/avif' | 'image/webp' | 'image/gif' | 'image/bmp' | 'image/tiff';
export declare function detectImageMime(bytes: Uint8Array): SniffedImageMime | null;
export declare function mapDeclaredToSniffed(declared: string): SniffedImageMime | null;
