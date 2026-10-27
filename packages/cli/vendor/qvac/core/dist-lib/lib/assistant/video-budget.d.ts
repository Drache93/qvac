import { type Size, type VideoProbe } from '../core/video/frames.ts';
export declare const VIDEO_FRAME_EDGE = 512;
export declare const MAX_VIDEO_FRAMES = 32;
export declare const MIN_VIDEO_FRAMES = 8;
export interface ContextReading {
    readonly ctxSize?: number;
    readonly cacheTokens?: number;
}
export interface FrameBudget extends ContextReading {
    readonly videos: number;
}
export declare function frameTokens({ width, height }: Size): number;
export declare function videoFrameCount(probe: VideoProbe, budget: FrameBudget): number;
