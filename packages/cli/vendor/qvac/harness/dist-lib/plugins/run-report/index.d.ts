import { type EngineBoot, type EngineStep, type MachineLog, type RunRecord } from '../../lib/run-log/index.ts';
export interface RunReportOptions {
    title?: string;
    live?: boolean;
}
export interface RunRecordingOptions {
    hopLog: () => RunHopLog;
}
export interface RunHopLog {
    boot: EngineBoot;
    onStep: (step: EngineStep) => Promise<void>;
    requestDigestKey: Uint8Array;
}
export interface RunRecording {
    hops: RunRecord[][];
    options: RunRecordingOptions;
}
export interface ReportParts {
    title: string;
    hero: string;
    jumps: string;
    canvas: string;
    machine: boolean;
    data: object;
}
export interface LiveReportOptions {
    source?: string;
}
export type RunSource = MachineLog | RunRecord[];
export interface RunChain {
    hops: RunSource[];
}
export declare class RunReport {
    static record(): RunRecording;
    static render(source: RunSource | RunChain, options?: RunReportOptions): Promise<string>;
    static parts(source: RunSource | RunChain, { title, live }?: RunReportOptions): Promise<ReportParts>;
    static live({ source }?: LiveReportOptions): string;
}
