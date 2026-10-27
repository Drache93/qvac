import { type MachineDefinitionNode } from '../../lib/machine/index.ts';
import { type MachineLog, type RunRecord } from '../../lib/run-log/index.ts';
import { type Story } from './story.ts';
import { type Candidate } from './why.ts';
export interface Change {
    path: string;
    before: unknown;
    after: unknown;
    kept?: number;
    appended?: unknown[];
}
export interface Microstep {
    eventType: string;
    from: unknown;
    to: unknown;
    candidates: Candidate[];
}
export interface TransitionStep {
    kind: 'transition';
    index: number;
    round: number;
    at: number;
    from: unknown;
    to: unknown;
    events: Record<string, unknown>[];
    micro: Microstep[];
    recorded: RunRecordTrace[];
    changes: Change[];
    entered: string[];
    taken: string[];
    facts: boolean;
    drift: boolean;
}
export interface ReceiptStep {
    kind: 'receipt';
    index: number;
    round: number;
    id: string;
    name: string;
    effect: string;
    args: unknown;
    result: unknown;
    settled: boolean;
}
export interface RequestStep {
    kind: 'request';
    index: number;
    round: number;
    attempt: number;
    droppedTurns: number;
    appended: unknown[];
    tools: string[];
}
export type Step = TransitionStep | ReceiptStep | RequestStep;
type RunRecordTrace = NonNullable<Extract<RunRecord, {
    type: 'delta';
}>['trace']>[number];
export interface RunSummary {
    runId: string;
    model: string;
    agent: string;
    startedAt: number | null;
    endedAt: number | null;
    tools: string[];
    maxToolRounds: number | null;
    deadline: number | null;
    status: string;
    outcome: string;
    response: string;
    rounds: number;
    tokens: number | null;
    machine: number | null;
    replay: string;
    failure: string;
}
export interface Hop {
    agent: string;
    model: string;
    reason: string;
    round: number;
    step: number;
}
export interface ReportModel {
    run: RunSummary;
    definition: MachineDefinitionNode | null;
    steps: Step[];
    visits: Record<string, number[]>;
    edges: Record<string, number[]>;
    story: Story;
    hops: Hop[];
    running: boolean;
}
export declare function reportModel(core: MachineLog, live?: boolean): Promise<ReportModel>;
export declare function activeIds(value: unknown, prefix: string): string[];
export {};
