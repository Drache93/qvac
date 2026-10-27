export declare const DIAGRAM_REPAIR_PROMPT_PREFIX = "<!-- qvac:diagram-repair:";
export declare const DIAGRAM_REPAIR_PROMPT_SUFFIX: string;
export declare function diagramRepairPromptCount(content: string, parentRunId?: string): number | null;
export declare function isDiagramRepairPrompt(content: string): boolean;
export declare function completeMermaidDiagramCount(content: string): number;
export declare function diagramRepairAccepted(text: string): boolean;
interface DiagramRepairRecord {
    readonly id: string;
    readonly seq: number;
    readonly runId?: string | null;
    readonly parentId?: string | null;
}
export interface DiagramRepairLink {
    readonly expectedCount: number;
    readonly parentId: string;
    readonly promptId: string;
    readonly promptText: string;
    readonly runId: string;
}
export declare function diagramRepairLinks<T extends DiagramRepairRecord>(records: ReadonlyArray<T>, textOf: (record: T) => string | null): ReadonlyArray<DiagramRepairLink>;
export {};
