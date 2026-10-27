import { type ImageInfo } from '../image.ts';
import type { Package } from './package.ts';
export declare const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
export interface ImagePlacement {
    source: string;
    dir: string;
}
export interface AddedImage {
    rId: string;
    part: string;
    info: ImageInfo;
}
export declare function addImage(pkg: Package, bytes: Uint8Array, at: ImagePlacement): AddedImage;
