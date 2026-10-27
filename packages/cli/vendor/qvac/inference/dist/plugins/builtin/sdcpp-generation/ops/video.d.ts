import { VideoStableDiffusion } from '@qvac/diffusion-cpp';
import { type VideoRequest, type VideoStreamResponse, type VideoStats } from '../../../../schemas/sdcpp-config.js';
export declare function markLtxVideoModel(model: VideoStableDiffusion): void;
export declare function markH3VideoModel(model: VideoStableDiffusion): void;
export declare function markMoeCapableVideoModel(model: VideoStableDiffusion): void;
export type VideoOpResult = {
    stats: VideoStats | undefined;
};
export declare function video(request: VideoRequest): AsyncGenerator<VideoStreamResponse, VideoOpResult>;
