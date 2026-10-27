import { mediaKindOf } from '../../../schema/media-kind.js';
const VIDEO_CONTAINERS = ['.mp4', '.m4v', '.mov'];
export function isVideoAttachment(fileName, mimeType) {
    const name = fileName.toLowerCase();
    return (mediaKindOf(mimeType, fileName) === 'video' ||
        VIDEO_CONTAINERS.some((extension) => name.endsWith(extension)));
}
