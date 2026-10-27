import type { ToolDefinition } from '../../lib/contract/index.ts';
import type { ImageClamps } from '../../lib/models/model-catalog.ts';
import { type DiffusionRuntime } from './generate-image.ts';
interface Rgba {
    width: number;
    height: number;
    data: Uint8Array;
    frames?: Rgba[];
}
interface Media {
    image: {
        decode(input: Uint8Array, opts?: {
            maxFrames?: number;
        }): Promise<Rgba>;
        encode(rgba: Rgba, opts: {
            mimetype: string;
        }): Promise<Uint8Array>;
    };
}
export interface EditImageDeps {
    loadMedia?: () => Promise<Media | null>;
    resample?: (rgba: Rgba, width: number, height: number) => Rgba | Promise<Rgba>;
}
export declare function loadMediaCodecs(): Promise<void>;
export declare function createEditImageTool(runtime: DiffusionRuntime, { loadMedia, resample }?: EditImageDeps, clamps?: ImageClamps): ToolDefinition;
export {};
