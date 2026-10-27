import type ASRGgml from '@qvac/asr-ggml';
export declare function isVadEvent(event: ASRGgml.ASRStreamOutput): event is ASRGgml.VadEvent;
export declare function isEndOfTurnEvent(event: ASRGgml.ASRStreamOutput): event is ASRGgml.EndOfTurnEvent;
export declare function toVadStateEvent(event: ASRGgml.VadEvent): {
    speakerId?: number;
    speaking: boolean;
    probability: number;
    source: "silero" | "energy" | "sortformer";
};
export declare function toEndOfTurnEvent(event: ASRGgml.EndOfTurnEvent): {
    source: "parakeet";
    silenceDurationMs?: never;
} | {
    source: "whisper";
    silenceDurationMs: number;
} | null;
