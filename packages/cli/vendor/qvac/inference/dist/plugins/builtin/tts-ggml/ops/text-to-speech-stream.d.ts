import { type TextToSpeechStreamRequest } from '../../../../schemas/index.js';
import Buffer from 'bare-buffer';
import { type TtsOpYield } from '../../../../utils/tts-stats.js';
import type { TtsOpResult } from './text-to-speech.js';
export declare function textToSpeechStream(params: TextToSpeechStreamRequest, inputStream: AsyncIterable<Buffer>): AsyncGenerator<TtsOpYield, TtsOpResult, unknown>;
