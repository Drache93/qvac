import b4a from 'b4a';
import fs from 'fs';
const AV_TIME_BASE = 1_000_000;
const YIELD_EVERY_PACKETS = 64;
const NO_PTS = -1;
const UPRIGHT = { rotate: 0, flipH: false, flipV: false };
const CORRECTIONS = new Map([
    ['0,-1,1,0', { rotate: 270, flipH: false, flipV: false }],
    ['-1,0,0,-1', { rotate: 180, flipH: false, flipV: false }],
    ['0,1,-1,0', { rotate: 90, flipH: false, flipV: false }],
    ['-1,0,0,1', { rotate: 0, flipH: true, flipV: false }],
    ['1,0,0,-1', { rotate: 0, flipH: false, flipV: true }],
    ['0,1,1,0', { rotate: 270, flipH: true, flipV: false }],
    ['0,-1,-1,0', { rotate: 270, flipH: false, flipV: true }]
]);
let loaded = null;
function loadFfmpeg() {
    loaded ??= import('bare-ffmpeg').then((mod) => mod.default);
    return loaded;
}
function fileIO(ff, fd) {
    const size = fs.fstatSync(fd).size;
    const { SET, END, SIZE } = ff.constants.seek;
    let offset = 0;
    return new ff.IOContext(4096, {
        onread: (buffer, requested) => {
            const read = fs.readSync(fd, buffer, 0, requested, offset);
            offset += read;
            return read;
        },
        onseek: (to, whence) => {
            if (whence === SIZE) {
                return size;
            }
            if (whence === SET) {
                offset = to;
            }
            else if (whence === END) {
                offset = size + to;
            }
            else {
                offset += to;
            }
            return offset;
        }
    });
}
function openInput(ff, file) {
    const fd = fs.openSync(file, 'r');
    try {
        const input = new ff.InputFormatContext(fileIO(ff, fd));
        return {
            input,
            close: () => {
                input.destroy();
                fs.closeSync(fd);
            }
        };
    }
    catch (err) {
        fs.closeSync(fd);
        throw err;
    }
}
export async function probeVideo(file) {
    const ff = await loadFfmpeg();
    const { input, close } = openInput(ff, file);
    try {
        const hasAudio = Boolean(input.getBestStream(ff.constants.mediaTypes.AUDIO));
        const video = input.getBestStream(ff.constants.mediaTypes.VIDEO);
        const formatDuration = input.duration > 0 ? input.duration / AV_TIME_BASE : 0;
        if (!video) {
            return {
                hasVideo: false,
                hasAudio,
                duration: formatDuration,
                width: 0,
                height: 0,
                aspect: 1,
                ...UPRIGHT
            };
        }
        const { numerator, denominator } = video.timeBase;
        const streamDuration = video.duration > 0 && denominator ? (video.duration * numerator) / denominator : 0;
        return {
            hasVideo: true,
            hasAudio,
            duration: streamDuration || formatDuration,
            width: video.codecParameters.width,
            height: video.codecParameters.height,
            aspect: pixelAspect(video),
            ...orientation(ff, video)
        };
    }
    finally {
        close();
    }
}
function orientation(ff, stream) {
    const matrix = stream.sideData.find((entry) => entry.type === ff.constants.packetSideDataType.DISPLAYMATRIX);
    if (!matrix) {
        return UPRIGHT;
    }
    const key = [0, 4, 12, 16]
        .map((offset) => snap(b4a.readInt32LE(matrix.data, offset) / 65536))
        .join(',');
    return CORRECTIONS.get(key) ?? UPRIGHT;
}
function snap(value) {
    return Math.abs(value - Math.round(value)) < 1e-3 ? Math.round(value) + 0 : value;
}
export function frameTimes(duration, count) {
    const slice = duration / count;
    return Array.from({ length: count }, (_, i) => (i + 0.5) * slice);
}
export function frameSize(probe, maxEdge) {
    const size = fit(probe.width * probe.aspect, probe.height, maxEdge);
    return probe.rotate % 180 ? { width: size.height, height: size.width } : size;
}
function fit(width, height, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const even = (n) => Math.max(2, Math.round((n * scale) / 2) * 2);
    return { width: even(width), height: even(height) };
}
function toRaster(ff, frame, size) {
    const { RGBA } = ff.constants.pixelFormats;
    const scaler = new ff.Scaler(frame.format, frame.width, frame.height, RGBA, size.width, size.height);
    const rgba = new ff.Frame();
    try {
        rgba.width = size.width;
        rgba.height = size.height;
        rgba.format = RGBA;
        rgba.alloc();
        scaler.scale(frame, rgba);
        const image = new ff.Image(RGBA, size.width, size.height);
        image.read(rgba);
        return { width: size.width, height: size.height, data: image.data };
    }
    finally {
        rgba.destroy();
        scaler.destroy();
    }
}
function* received(decoder, frame) {
    while (decoder.receiveFrame(frame)) {
        yield frame;
    }
}
async function* decodedFrames(ff, input, stream) {
    const decoder = stream.decoder();
    const packet = new ff.Packet();
    const frame = new ff.Frame();
    try {
        decoder.open();
        let packets = 0;
        while (input.readFrame(packet)) {
            if (packet.streamIndex === stream.index && decoder.sendPacket(packet)) {
                yield* received(decoder, frame);
            }
            packet.unref();
            if (++packets % YIELD_EVERY_PACKETS === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        decoder.sendPacket(new ff.Packet());
        yield* received(decoder, frame);
    }
    finally {
        frame.destroy();
        packet.destroy();
        decoder.destroy();
    }
}
function pixelAspect(stream) {
    const sar = stream.codecParameters.sampleAspectRatio;
    return sar && sar.numerator > 0 && sar.denominator > 0 ? sar.numerator / sar.denominator : 1;
}
async function pick(ff, input, opts) {
    const stream = input.getBestStream(ff.constants.mediaTypes.VIDEO);
    if (!stream) {
        return [];
    }
    const targets = [...opts.times].sort((x, y) => x - y);
    const tb = stream.timeBase.numerator / stream.timeBase.denominator;
    const aspect = pixelAspect(stream);
    const picked = [];
    let origin = null;
    for await (const frame of decodedFrames(ff, input, stream)) {
        const pts = frame.pts === NO_PTS ? frame.packetDTS : frame.pts;
        origin ??= pts;
        const time = (pts - origin) * tb;
        while (picked.length < targets.length && time >= targets[picked.length]) {
            const size = fit(frame.width * aspect, frame.height, opts.maxEdge);
            picked.push({ time, raster: toRaster(ff, frame, size) });
        }
        if (picked.length === targets.length) {
            break;
        }
    }
    return picked;
}
export async function sampleFrames(file, opts) {
    const ff = await loadFfmpeg();
    const media = await import('bare-media');
    const { input, close } = openInput(ff, file);
    let picked;
    try {
        picked = await pick(ff, input, opts);
    }
    finally {
        close();
    }
    const { rotate, flipH, flipV } = opts.probe;
    const orientate = media.image.orientate;
    const frames = [];
    for (const { time, raster } of picked) {
        const upright = rotate || flipH || flipV
            ? await orientate(raster, { transform: { rotate, flipH, flipV } })
            : raster;
        const jpeg = await media.image.encode(upright, { mimetype: 'image/jpeg' });
        frames.push({ time, width: upright.width, height: upright.height, jpeg });
    }
    return frames;
}
