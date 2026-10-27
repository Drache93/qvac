// Hand-written declarations for media-kind.js, for strict consumers without allowJs.
export const MEDIA_KINDS: readonly ['audio', 'image', 'video', 'other']
export const AUDIO_EXTENSIONS: readonly string[]
export function mediaKindOf(
  mimeType?: string,
  fileName?: string
): 'audio' | 'image' | 'video' | 'other'
export function mediaKindOrdinal(kind: string): number
