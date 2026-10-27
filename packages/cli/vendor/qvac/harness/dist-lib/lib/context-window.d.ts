import type { Message } from './contract/index.ts';
export declare const TOOL_RESULT_TRUNCATION_MARKER = "\n[tool result truncated for context]\n";
export declare const TOOL_SEARCH_RESULT = "{\"tool_search\":";
export declare function compactedFrom(message: Message): Message | undefined;
export interface ContextCandidate {
    history: Message[];
    droppedTurns: number;
}
export declare function contextCandidates(history: Message[], ...nudges: string[]): ContextCandidate[];
export declare function compactContent(content: string, target: number): string;
