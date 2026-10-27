export declare const VIDEO_DIGEST_MIME = "application/vnd.qvac.video-frames";
export declare const VIDEO_AUDIO: readonly ['none', 'silent', 'speech', 'unheard'];
export type VideoAudio = (typeof VIDEO_AUDIO)[number];
export interface VideoDigestHeader {
    readonly duration: number;
    readonly times: ReadonlyArray<number>;
    readonly audio: VideoAudio;
    readonly transcript?: string;
}
export interface VideoDigest extends VideoDigestHeader {
    readonly frames: ReadonlyArray<Uint8Array>;
}
export declare function parseVideoDigestHeader(json: string): VideoDigestHeader;
export declare function videoDigestFileName(videoFileName: string): string;
export declare function packVideoDigest(digest: VideoDigest): Uint8Array;
export declare function unpackVideoDigest(bytes: Uint8Array): VideoDigest;
