export interface OperationRequest {
    body?: Record<string, unknown>;
    params?: Record<string, unknown>;
    encode?: Record<string, string>;
    query?: Record<string, unknown>;
}
export type BuilderOutcome = {
    request: OperationRequest;
} | {
    error: string;
};
export interface OperationBuilder {
    build: (args: Record<string, unknown>) => BuilderOutcome;
}
export declare const BUILDER_POLICY_VERSION = 1;
export declare const BUILDER_NAMES: readonly ['gmail-send', 'gmail-draft', 'gmail-get', 'calendar-meet-event', 'calendar-add-meet', 'docs-create', 'docs-append-text', 'sheets-create', 'sheets-write-values', 'sheets-append-values', 'drive-create-folder', 'drive-trash', 'notion-create-page', 'notion-insert-content'];
export type BuilderName = (typeof BUILDER_NAMES)[number];
export declare const BUILDERS: Record<BuilderName, OperationBuilder>;
