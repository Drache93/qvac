import { type TtsRequest, type TtsStats } from '../../../../schemas/index.js';
import { type TtsOpYield } from '../../../../utils/tts-stats.js';
/** What the handler turns into the terminal frame. */
export type TtsOpResult = {
    modelExecutionMs: number;
    stats?: TtsStats;
    cancelled?: boolean;
};
export declare function textToSpeech(params: TtsRequest): AsyncGenerator<TtsOpYield, TtsOpResult>;
