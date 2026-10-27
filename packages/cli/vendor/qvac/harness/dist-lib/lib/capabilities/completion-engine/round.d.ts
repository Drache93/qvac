import type { CompletionFinal, CompletionStats, Tool as SdkTool, ToolDialect } from '@qvac/inference';
import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type KnownTool } from '../../helpers/tool-call-markup.ts';
import { type TextEvent } from '../../helpers/thinking.ts';
import type { CompletionHistoryEntry, LlmGenerationParams } from '../../contract/index.ts';
import type { CompletionSdk, InferenceCallEvent, InferenceSentEvent, FoldEvent, Message, ResponseFormat, RoundModelLease, RoundSpeed, RunLifecycleEvent } from '../../contract/index.ts';
import { type FailureTurn } from '../tool-turns.ts';
import { type CompletionParams } from '../../helpers/completion-params.ts';
import type { ModelRequest } from '../../run-log/index.ts';
import { type FailureResultValue } from '../../helpers/failure-result.ts';
import { type FoldReading } from '../../fold/index.ts';
export declare function foldTokens(stats: CompletionStats | undefined, cacheable: boolean | undefined): number | undefined;
export interface RecoveredRound {
    contentText: string;
    final: CompletionFinal;
    history: CompletionHistoryEntry[];
    cacheable: boolean;
    unproven: string | null;
    replay: string | null;
    reasoningDeltas?: number | undefined;
    ctxSize?: number | undefined;
    overflows?: number | undefined;
    cut?: string | undefined;
}
export interface RoundArgs {
    modelId: string;
    acquireRound?: ((signal?: BareAbortSignal) => Promise<RoundModelLease>) | undefined;
    history: CompletionHistoryEntry[];
    failureResults: Readonly<Record<string, FailureResultValue>>;
    continuationNudge: string;
    deliveredNudge: string;
    tools?: SdkTool[] | undefined;
    generationParams?: Partial<LlmGenerationParams> | undefined;
    responseFormat?: ResponseFormat | undefined;
    toolDialect?: ToolDialect | undefined;
    cacheKey?: string | undefined;
    signal?: BareAbortSignal | undefined;
    round: number;
    runId?: string | undefined;
    promptPrefix: string;
    capture: boolean;
    knownTools?: ReadonlyArray<KnownTool> | undefined;
    unforced?: {
        generationParams?: Partial<LlmGenerationParams> | undefined;
    } | undefined;
    recordRequest?: ((request: ModelRequest, failures: readonly FailureTurn[]) => Promise<void>) | undefined;
    fold?: RoundFold | undefined;
    live: LiveRound;
}
export interface LiveRound {
    readonly round: number;
    readonly kind: RoundKind;
    readonly startedAt: number;
    rawChars: number;
    reasoningDeltas: number;
    cut?: ((note: string) => void) | undefined;
}
export type RoundKind = NonNullable<RoundSpeed['kind']>;
export interface RoundFold {
    messages: readonly Message[];
    nudge: string;
    ctxSize?: number | undefined;
    cacheKey?: string | undefined;
    instructions?: ((messages: readonly Message[]) => Promise<string | undefined>) | undefined;
    reading?: FoldReading | undefined;
}
type RoundReset = Extract<RunLifecycleEvent, {
    type: 'round-reset';
}>;
export type RoundEvent = TextEvent | InferenceCallEvent | InferenceSentEvent | RoundReset | FoldEvent;
export declare function runRecoveredRound(sdk: CompletionSdk | undefined, args: RoundArgs): AsyncGenerator<RoundEvent, RecoveredRound>;
export declare function recordWholeRound(args: RoundArgs): Promise<CompletionParams>;
export {};
