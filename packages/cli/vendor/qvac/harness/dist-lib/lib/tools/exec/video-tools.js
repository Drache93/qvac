const TRANSCODERS = new Set([
    'ffmpeg',
    'ffprobe',
    'ffmpeg-python',
    'imageio-ffmpeg',
    'moviepy',
    'avconv',
    'ytdl'
]);
const DOWNLOADERS = new Set([
    'yt-dlp',
    'youtube-dl',
    'you-get',
    'streamlink',
    'pytube',
    'pytubefix'
]);
export const VIDEO_TOOLS_ERROR = 'downloading or transcoding video is not possible on this device: yt-dlp, youtube-dl, ffmpeg ' +
    'and similar tools cannot run here, on any path. Do not retry; tell the user it cannot be done.';
export const TRANSCODE_ERROR = 'ffmpeg is not available on this device: ffmpeg, ffprobe and the packages that run them ' +
    '(moviepy, ffmpeg-python) cannot run here, on any path, so nothing can merge or convert ' +
    'video. Fetch a single file that needs neither, or tell the user it cannot be done.';
export function videoTool(name) {
    const bare = (name
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .split(/[=<>!~[\s]/)[0] ?? '')
        .toLowerCase()
        .replace(/\.exe$/, '')
        .replace(/[-_.]+/g, '-');
    return TRANSCODERS.has(bare) || DOWNLOADERS.has(bare) ? bare : null;
}
export function isTranscoder(tool) {
    return TRANSCODERS.has(tool);
}
