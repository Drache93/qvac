// imported at runtime by indexes.js under the generated spec — stays plain .js

// MEDIA_KINDS is the ordinal source of truth; the wire enum in engine.ts registers from it
export const MEDIA_KINDS = ['audio', 'image', 'video', 'other']

// `.mp4` is audio: recordings ship in the mp4 container and are transcribed from their audio
export const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4']
const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
  '.avif'
]
const VIDEO_EXTENSIONS = ['.mov', '.webm', '.mkv', '.avi', '.m4v']

function endsWithAny(name, extensions) {
  return extensions.some((extension) => name.endsWith(extension))
}

// mime first, then extension, so a generated audio/wav and a user recording.m4a both land in audio
export function mediaKindOf(mimeType, fileName) {
  const mime = (mimeType || '').toLowerCase()
  const name = (fileName || '').toLowerCase()
  if (mime.startsWith('audio/') || endsWithAny(name, AUDIO_EXTENSIONS)) {
    return 'audio'
  }

  if (mime.startsWith('image/') || endsWithAny(name, IMAGE_EXTENSIONS)) {
    return 'image'
  }

  if (mime.startsWith('video/') || endsWithAny(name, VIDEO_EXTENSIONS)) {
    return 'video'
  }

  return 'other'
}

export function mediaKindOrdinal(kind) {
  const ordinal = MEDIA_KINDS.indexOf(kind)
  if (ordinal === -1) {
    throw new Error('Unknown media kind: ' + kind)
  }

  return ordinal + 1
}
