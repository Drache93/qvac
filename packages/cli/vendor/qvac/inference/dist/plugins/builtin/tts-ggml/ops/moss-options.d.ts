import type { TtsRequest } from '../../../../schemas/index.js';
/** Reject incompatible controls before the addon can silently ignore them. */
export declare function getMossJobOptions(model: unknown, request: TtsRequest): {
    topK?: number;
    topP?: number;
    temperature?: number;
    greedy?: boolean;
    maxNewTokens?: number;
    maxReplySeconds?: number;
    textReply?: boolean;
    replyVoiceSampleRate?: number;
    replyVoice?: Float32Array<ArrayBuffer>;
    systemPrompt?: string;
    messages?: {
        sampleRate?: number;
        audio?: Float32Array<ArrayBuffer>;
        text?: string;
        role: "assistant" | "system" | "user";
    }[];
    sampleRate?: number;
    audio?: Float32Array<ArrayBuffer>;
};
