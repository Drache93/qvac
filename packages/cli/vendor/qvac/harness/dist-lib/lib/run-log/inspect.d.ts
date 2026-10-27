import { type RunLogInspectionEntry, type RunRecord } from './run-journal.ts';
import type { MachineLog } from './protocol-types.ts';
interface InspectionOptions {
    recordLimit?: number;
    contextRecord?: number;
    requestRecord?: number;
    physicalLength?: number;
    contextPhysicalLength?: number;
    expectedMachineVersion?: number;
    expectedXstateVersion?: string;
}
export interface PositionedRunRecord {
    recordIndex: number;
    stepSeq: number;
    physicalLength: number;
    record: RunRecord;
}
interface PositionedInspectionEnvelope {
    records: () => AsyncIterable<PositionedRunRecord>;
    physicalLength?: unknown;
    logicalLength?: unknown;
    nextSeq?: unknown;
}
type InspectionCore = MachineLog | PositionedInspectionEnvelope;
type Position = Pick<PositionedRunRecord, 'stepSeq' | 'physicalLength'>;
export declare function recordLog(values: RunRecord[]): MachineLog;
export declare function stateValue(snapshot: unknown): unknown;
export declare function contextValue(snapshot: unknown): unknown;
interface RecordLineOptions {
    position?: Position;
    context?: boolean;
    expectedMachineVersion?: number;
    expectedXstateVersion?: string;
    requestRecord?: number;
}
export declare class RecordLines {
    private previous;
    private base;
    private readonly requests;
    printedRequest: boolean;
    render(entry: RunLogInspectionEntry, opts?: RecordLineOptions): string[];
    private transitionLines;
}
export declare function verificationLine(core: MachineLog, machine: number | undefined, xstate: string | undefined): Promise<string>;
export declare function inspectRun(core: InspectionCore, opts?: InspectionOptions): AsyncGenerator<string>;
export declare function escapeHtml(value: string): string;
export declare function activeStatePaths(definition: unknown, value: unknown): string[];
export declare const HTML_HEAD: string;
export declare const HTML_RECORDS_END = "</pre>";
export declare const HTML_TAIL = "</body></html>";
export declare function htmlRunStart(definition: unknown): string;
export declare function renderRunLogHtml(core: InspectionCore, opts?: InspectionOptions): Promise<string>;
export {};
