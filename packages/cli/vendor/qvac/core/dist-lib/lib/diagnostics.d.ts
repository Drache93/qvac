import type { MemoryBudget } from '@qvac/harness';
export interface HarnessDiagnostics {
    models: Array<{
        model: string;
        refs: number;
    }>;
    suspended: boolean;
    sdkLoaded: boolean;
    toolNames: string[];
    skills: string[];
    device?: 'cpu' | 'gpu';
}
export interface RunSummary {
    runId: string;
    chatId: string;
    model: string;
}
export interface AssistantDiagnostics {
    suspended: boolean;
    runs: RunSummary[];
    activeChats: number;
    queued: number;
}
export interface BackendUse {
    requestedGpu: boolean;
    device: string;
    backend: string;
}
export interface DiagnosticsSlice {
    harness: HarnessDiagnostics | null;
    assistant: AssistantDiagnostics;
    platform: string;
    mobileClass: boolean;
    memoryBudget: MemoryBudget | null;
    backendUse: Record<string, BackendUse[]>;
}
export declare function recordBackends(into: Map<string, BackendUse[]>, backends: unknown): void;
export declare function summarizeRuns(runs: Iterable<RunSummary>, suspended: boolean): AssistantDiagnostics;
