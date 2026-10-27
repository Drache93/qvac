import type { CompletionHistoryEntry, Message, ToolDefinition, TrustedSource, TurnContext } from '../../contract/index.ts';
export declare function trustedSourcesFrom(history: readonly Message[]): TrustedSource[];
export declare function sanitizeTurn(turn: Message, answered?: boolean): Message;
export declare function modelTurns(messages: readonly Message[], nudge: string): Message[];
interface TurnImage {
    path: string;
}
export declare function lastUserImages(messages: Message[]): TurnImage[];
export declare function explicitWebSearchQuery(text: string, tools: ReadonlyArray<ToolDefinition>, { skillPreloaded }: ExplicitWebSearchOptions): string | null;
interface ExplicitWebSearchOptions {
    skillPreloaded: boolean;
}
interface DirectToolTurns {
    tool?: string | undefined;
    id?: string | undefined;
    args: Record<string, unknown>;
    output: unknown;
    resultRef?: string | undefined;
    nudge: string;
}
export declare function directToolHistory(history: CompletionHistoryEntry[], { tool, id, args, output, resultRef, nudge }: DirectToolTurns): CompletionHistoryEntry[];
interface AssistantToolCall {
    name: string;
    arguments?: Record<string, unknown>;
}
export declare function assistantToolTurn(contentText: string, calls: ReadonlyArray<AssistantToolCall>): string;
export declare function withLastUserNote(messages: readonly CompletionHistoryEntry[], note: string): CompletionHistoryEntry[];
export declare function turnText(text: string, { time, excerpts, notes }: TurnContext): string;
export declare function withTurnContext(messages: readonly Message[], context: TurnContext): Message[];
export declare function carriesRunOnlyText(history: readonly CompletionHistoryEntry[]): boolean;
export declare function annotateCompletionHistoryLastUserTime(history: readonly CompletionHistoryEntry[], now?: Date): CompletionHistoryEntry[];
export {};
