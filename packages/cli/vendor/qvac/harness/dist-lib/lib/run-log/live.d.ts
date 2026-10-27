import type { CompletionContext } from '../machine/index.ts';
import type { EngineStep, HostRunLog, MachineTransitionTrace } from './protocol-types.ts';
export interface RunLogView {
    runId: string;
    seq: number;
    index: number;
    state: unknown;
    trace: MachineTransitionTrace[];
    lines: string[];
    approval: CompletionContext['approval'] | null;
    pendingCall: CompletionContext['pendingCall'];
    currentCall: CompletionContext['currentCall'];
    toolQueue: CompletionContext['toolQueue'];
    outcome: CompletionContext['outcome'];
    error?: string;
}
export declare class RunLogWatch {
    private readonly viewFeed;
    private readonly htmlFeed;
    private readonly runs;
    private open;
    private graphs;
    private started;
    private ended;
    private pending;
    step(step: EngineStep): void;
    views(): AsyncIterable<RunLogView>;
    html(): AsyncIterable<string>;
    host(inner: HostRunLog): HostRunLog;
    end(): Promise<void>;
    private feed;
    private record;
    private show;
    private start;
    private close;
    private write;
}
