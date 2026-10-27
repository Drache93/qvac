export interface Orientation {
    readonly rotate: 0 | 90 | 180 | 270;
    readonly flipH: boolean;
    readonly flipV: boolean;
}
export interface VideoProbe extends Orientation {
    readonly hasVideo: boolean;
    readonly hasAudio: boolean;
    readonly duration: number;
    readonly width: number;
    readonly height: number;
    readonly aspect: number;
}
export interface SampledFrame {
    readonly time: number;
    readonly width: number;
    readonly height: number;
    readonly jpeg: Uint8Array;
}
export interface SampleOptions {
    readonly times: ReadonlyArray<number>;
    readonly maxEdge: number;
    readonly probe: VideoProbe;
}
export interface Size {
    readonly width: number;
    readonly height: number;
}
export declare function probeVideo(file: string): Promise<VideoProbe>;
export declare function frameTimes(duration: number, count: number): number[];
export declare function frameSize(probe: VideoProbe, maxEdge: number): Size;
export declare function sampleFrames(file: string, opts: SampleOptions): Promise<SampledFrame[]>;
