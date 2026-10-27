export interface TranscriptRecord {
    id: string;
    seq: number;
    type: string;
    runId?: string | null;
    round?: number | null;
    resumed?: boolean | null;
    runStatus?: {
        state?: string | null;
        progress?: {
            phase?: string | null;
        } | null;
    } | null;
    roundReset?: {
        replacedTypes?: ReadonlyArray<string> | null;
    } | null;
}
export declare function attemptStarts(chunks: ReadonlyArray<TranscriptRecord>): Map<string, number>;
export declare function hiddenTranscriptText<T extends TranscriptRecord>(chunks: ReadonlyArray<T>): Set<string>;
