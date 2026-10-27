export interface RecoveredToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    raw?: string;
}
export declare const MAX_RAW_CALL_CHARS = 4096;
export declare const MALFORMED_CALL_ID = "call-malformed";
export declare function clipRawCall(raw: string): string;
export interface KnownTool {
    readonly name: string;
}
export declare function recoverMarkupToolCalls(text: string, knownTools: ReadonlyArray<KnownTool>): RecoveredToolCall[];
export declare function redactToolCallMarkup(text: string, redactArgs: (name: string, args: Record<string, unknown>) => Record<string, unknown>): string;
export declare function redactBareParameterMarkup(text: string, isSensitiveName: (name: string) => boolean): string;
export declare function stripToolCallMarkup(text: string): string;
export declare function stripToolResponseBlocks(text: string): string;
export interface MarkupToolCall {
    readonly name: string;
    readonly arguments?: Record<string, unknown>;
}
export declare function toolCallMarkup(calls: ReadonlyArray<MarkupToolCall>): string;
export declare function normalizeToolArgs(args: Record<string, unknown>, declaredKeys: ReadonlyArray<string>): Record<string, unknown>;
export declare function recoverSkillNamedCall(text: string, skillNames: ReadonlyArray<string>, skillToolName: string): RecoveredToolCall[];
export declare function recoverPrintedSkillLoad(text: string, skillToolName: string): RecoveredToolCall[];
