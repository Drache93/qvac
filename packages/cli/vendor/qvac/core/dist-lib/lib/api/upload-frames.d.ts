import type { HandlerFrames } from '../../spec/capabilities.d.ts';
export type UploadFrames<Frame> = AsyncIterable<Frame> | HandlerFrames<Frame>;
export interface OpenedUpload<Frame> {
    readonly first: Frame;
    readonly rest: AsyncIterable<Frame>;
}
export declare function openUpload<Frame>(frames: UploadFrames<Frame>): Promise<OpenedUpload<Frame> | null>;
