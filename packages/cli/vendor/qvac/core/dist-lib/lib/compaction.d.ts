import type { AssistantChunk } from '../spec/hyperschema/types.d.ts';
export declare const COMPACTION_KEEP_TURNS = 1;
export declare const COMPACTION_TURN_PREFIX = "[Summary of the earlier conversation in this chat, written by another model. Treat it as established context, not as a new request.]";
export declare function compactionTurn(summary: string): string;
export interface TranscriptTurn {
    readonly role: string;
    readonly content: string;
}
export declare function foldReducesPrompt(folded: ReadonlyArray<Pick<TranscriptTurn, 'content'>>, summary: string): boolean;
export declare function canCompact(ctxSize: number | undefined): boolean;
export declare function buildCompactionPrompt(turns: ReadonlyArray<TranscriptTurn>, hasPriorSummary: boolean): string;
export declare function parseCompactionSummary(text: string): string | null;
export interface CompactionBoundary {
    throughId: string;
    foldedTurns: number;
}
export declare function compactionBoundary(chunks: ReadonlyArray<AssistantChunk>, keepTurns?: number): CompactionBoundary | null;
export declare function lastCompactedThroughId(chunks: ReadonlyArray<AssistantChunk>): string | null;
export interface FoldedChunks {
    chunks: ReadonlyArray<AssistantChunk>;
    summary: string | null;
}
export declare function foldCompactedChunks(chunks: ReadonlyArray<AssistantChunk>): FoldedChunks;
export declare const COMPACTION_TRIGGER_TIERS: ReadonlyArray<readonly [below: number, ratio: number]>;
export declare const COMPACTION_TRIGGER_RATIO = 0.95;
export declare function compactionTriggerRatio(ctxSize: number): number;
export declare function nearContextLimit(cacheTokens: number | undefined, ctxSize: number | undefined): boolean;
export declare function isContextOverflowFailure(message: string | undefined): boolean;
