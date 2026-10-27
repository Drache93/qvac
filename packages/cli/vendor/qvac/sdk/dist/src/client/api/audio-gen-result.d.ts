import { type AudioEditClientParams, type AudioEditStreamRequest, type AudioGenClientParams, type AudioGenResult, type AudioGenStreamRequest, type AudioUnderstandClientParams, type AudioUnderstandRequest, type AudioUnderstandResult } from '@qvac/inference/surface';
export type AudioGenStreamFactory = (request: AudioGenStreamRequest) => AsyncGenerator<unknown>;
export type AudioEditStreamFactory = (request: AudioEditStreamRequest) => AsyncGenerator<unknown>;
export type AudioUnderstandStreamFactory = (request: AudioUnderstandRequest) => AsyncGenerator<unknown>;
export declare function createAudioGenResult(params: AudioGenClientParams, streamFactory: AudioGenStreamFactory): AudioGenResult;
export declare function createAudioEditResult(params: AudioEditClientParams, streamFactory: AudioEditStreamFactory): AudioGenResult;
export declare function createAudioUnderstandResult(params: AudioUnderstandClientParams, streamFactory: AudioUnderstandStreamFactory): AudioUnderstandResult;
//# sourceMappingURL=audio-gen-result.d.ts.map