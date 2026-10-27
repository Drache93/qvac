import { type DiagramRepairLink } from '@qvac/harness/lib/diagram-repair.ts';
import type { AssistantChunk } from '../../spec/hyperschema/types.d.ts';
export interface HistoryBranches {
    readonly repairs: ReadonlyArray<DiagramRepairLink>;
    readonly repairByRunId: ReadonlyMap<string, DiagramRepairLink>;
    readonly hiddenChunkIds: ReadonlySet<string>;
    readonly rejectedRunIds: ReadonlySet<string>;
    readonly deadRanges: ReadonlyArray<readonly [number, number]>;
}
export declare function historyBranches(all: ReadonlyArray<AssistantChunk>, currentRunId?: string): HistoryBranches;
export declare function isPromptChunk(chunk: AssistantChunk, branches: HistoryBranches): boolean;
export declare function acceptedRepairCount(branches: HistoryBranches, currentRunId?: string): number;
