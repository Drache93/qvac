import { frameSize } from '../core/video/frames.js';
export const VIDEO_FRAME_EDGE = 512;
export const MAX_VIDEO_FRAMES = 32;
export const MIN_VIDEO_FRAMES = 8;
const ANSWER_SHARE = 0.25;
const UNREAD_SHARE = 0.5;
const TILE = 32;
const FRAME_MARKER_TOKENS = 6;
export function frameTokens({ width, height }) {
    return Math.ceil(width / TILE) * Math.ceil(height / TILE) + FRAME_MARKER_TOKENS;
}
function room({ ctxSize, cacheTokens }) {
    if (!ctxSize) {
        return null;
    }
    if (cacheTokens === undefined) {
        return ctxSize * UNREAD_SHARE;
    }
    return ctxSize * (1 - ANSWER_SHARE) - cacheTokens;
}
export function videoFrameCount(probe, budget) {
    const perSecond = Math.max(1, Math.floor(probe.duration));
    const free = room(budget);
    const fits = free === null
        ? MAX_VIDEO_FRAMES
        : Math.floor(free / Math.max(1, budget.videos) / frameTokens(frameSize(probe, VIDEO_FRAME_EDGE)));
    const frames = Math.min(MAX_VIDEO_FRAMES, Math.max(MIN_VIDEO_FRAMES, fits));
    return Math.min(perSecond, frames);
}
