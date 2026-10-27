import type { AudioGenStreamRequest, AudioGenStreamResponse } from '../../../../schemas/audio-gen.js';
export declare function audioGenStream(request: AudioGenStreamRequest): AsyncGenerator<AudioGenStreamResponse>;
