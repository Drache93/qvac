export interface Limits {
    maxEntries: number;
    maxSize: number;
    maxRatio: number;
}
export interface ZipEntry {
    name: string;
    data: Uint8Array;
}
export interface ZipInput extends ZipEntry {
    compress: boolean;
}
export declare function crc32(data: Uint8Array): number;
export declare function read(bytes: Uint8Array, limits: Limits): ZipEntry[];
export declare function write(entries: ZipInput[]): Uint8Array;
