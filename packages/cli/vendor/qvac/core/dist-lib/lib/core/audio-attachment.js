import { mediaKindOf } from '../../schema/media-kind.js';
export function isAudioAttachment(fileName, mimeType) {
    return mediaKindOf(mimeType, fileName) === 'audio';
}
