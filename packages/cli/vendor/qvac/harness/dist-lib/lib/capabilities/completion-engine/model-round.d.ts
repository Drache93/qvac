import type { CompletionFinal, Tool as SdkTool, ToolDialect } from '@qvac/inference';
import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { TextEvent } from '../../helpers/thinking.ts';
import type { CompletionSdk, LlmGenerationParams, Message, ResponseFormat, RoundModelLease, RunLifecycleEvent } from '../../contract/index.ts';
export interface ModelRoundRequest {
    runId: string;
    round: number;
    kind: 'streaming' | 'wrap-up';
    attempt: number;
    modelId: string;
    history: Message[];
    tools?: SdkTool[] | undefined;
    toolSet?: string | undefined;
    generationParams?: Partial<LlmGenerationParams> | undefined;
    responseFormat?: ResponseFormat | undefined;
    toolDialect?: ToolDialect | undefined;
    cacheKey?: string | undefined;
    promptPrefix: string;
    continuationNudge: string;
    deliveredNudge: string;
    unforced?: {
        generationParams?: Partial<LlmGenerationParams> | undefined;
    } | undefined;
}
export interface ModelRoundResult {
    contentText: string;
    final: CompletionFinal;
    cut?: string | undefined;
    unproven?: string | null | undefined;
    replay?: string | null | undefined;
    reasoningDeltas?: number | undefined;
    ctxSize?: number | undefined;
    overflows?: number | undefined;
}
export type ModelRoundEvent = TextEvent;
type RoundReset = Extract<RunLifecycleEvent, {
    type: 'round-reset';
}>;
export interface ModelRoundIo {
    signal: BareAbortSignal;
    emit(event: ModelRoundEvent): void;
    retake(): (event: ModelRoundEvent) => void;
}
export type ModelRoundPort = (request: ModelRoundRequest, io: ModelRoundIo) => Promise<ModelRoundResult>;
interface RunOptions {
    signal?: BareAbortSignal | undefined;
    emit(event: ModelRoundEvent | RoundReset): void;
}
export interface ModelRoundServeOptions {
    sdk?: CompletionSdk | undefined;
    acquireRound?: ((signal?: BareAbortSignal) => Promise<RoundModelLease>) | undefined;
}
export declare class ModelRound {
    port: ModelRoundPort;
    constructor(port: ModelRoundPort);
    run(request: ModelRoundRequest, options: RunOptions): Promise<ModelRoundResult>;
    static run(port: ModelRoundPort, request: ModelRoundRequest, { signal, emit }: RunOptions): Promise<ModelRoundResult>;
    static serve(request: ModelRoundRequest, io: ModelRoundIo, { sdk, acquireRound }: ModelRoundServeOptions): Promise<ModelRoundResult>;
}
export {};
