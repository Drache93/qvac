import type { AbortSignal } from 'bare-abort-controller';
import type { AssistantChunk } from '../../spec/hyperschema/types.d.ts';
import type { ScopedCapabilities } from '../mesh-scoped-engine.ts';
import type { OwnerRounds } from './model-round.ts';
import type { DiagramRepairLink } from '@qvac/harness/lib/diagram-repair.ts';
import type { ChatMessage } from './message.ts';
export declare function senderOf(chunk: AssistantChunk): string | undefined;
export declare const TERMINAL_STATES: Set<string>;
export declare const HISTORY_TYPES: AssistantChunk['type'][];
export declare const SKILL_TOOL = "skill";
export interface StaleToolRuns {
    runIds: Set<string>;
    questionChunkIds: Set<string>;
}
export declare function listHistoryChunks(engine: Pick<ScopedCapabilities, 'listChunks'>, chatId: string): Promise<AssistantChunk[]>;
export declare function latestAttemptStarts(chunks: ReadonlyArray<AssistantChunk>): Map<string, number>;
export declare function beforeLatestAttempt(chunk: AssistantChunk, starts: Map<string, number>): boolean;
export interface RunAt {
    readonly request: Pick<AssistantChunk, 'seq' | 'requesterMemberId'>;
    readonly runId: string;
}
export interface CompactOptions {
    readonly signal?: AbortSignal;
    readonly run?: RunAt;
    readonly onFold?: () => Promise<void> | void;
    readonly meshId: string;
    readonly rounds?: OwnerRounds | undefined;
}
export type CompactionTrigger = 'before-run' | 'overflow';
export interface CompactResult {
    readonly compacted: boolean;
    readonly foldedTurns?: number;
    readonly reason?: string;
}
export interface HistoryReplay {
    readonly sentRuns?: ReadonlyMap<string, ReadonlyArray<ChatMessage>>;
    readonly askedRuns?: ReadonlyMap<string, string>;
    readonly readRuns?: ReadonlyMap<string, string>;
}
export declare function historyFromChunks(chunks: ReadonlyArray<AssistantChunk>, stale?: Partial<StaleToolRuns>, { sentRuns, askedRuns, readRuns }?: HistoryReplay): ChatMessage[];
export interface RunPromptView {
    readonly history: AssistantChunk[];
    readonly stale: StaleToolRuns;
    readonly repair: DiagramRepairLink | undefined;
    readonly acceptedRepairs: number;
}
export declare function runPromptView(all: ReadonlyArray<AssistantChunk>, approvals: ReadonlyArray<AssistantChunk>, run: RunAt): RunPromptView;
export interface RoundReplay {
    readonly sentRuns: Map<string, ChatMessage[]>;
    readonly readRuns: Map<string, string>;
}
export declare function replayFromChunks(rounds: ReadonlyArray<AssistantChunk>): RoundReplay;
export declare function sentTurn(chunk: AssistantChunk): string | undefined;
export declare function runView(chunks: ReadonlyArray<AssistantChunk>, { request, runId }: RunAt): AssistantChunk[];
export declare function foldableView(chunks: ReadonlyArray<AssistantChunk>, run: RunAt): AssistantChunk[];
export declare function viewOutgrewCache(chunks: ReadonlyArray<AssistantChunk>, run: RunAt, cachedRuns: ReadonlyMap<string, unknown>): boolean;
export declare function normalizeQuestion(text: string): string;
export declare const GENERIC_ACKNOWLEDGEMENTS: Set<string>;
export declare function isGenericAcknowledgement(question: string): boolean;
export declare function staleToolRunIds(historyChunks: ReadonlyArray<AssistantChunk>, approvalChunks: ReadonlyArray<AssistantChunk>, currentRunId: string): StaleToolRuns;
