import type { LineLevel } from '../../../lib/log.ts';
import type { PythonRunResult, RunSpec } from '../run-session.ts';
export type HostMessage = {
    readonly type: 'run';
    readonly id: number;
    readonly spec: RunSpec;
} | {
    readonly type: 'close';
} | {
    readonly type: 'connect-answer';
    readonly allowed: boolean;
};
export interface WireResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
    readonly files?: ReadonlyArray<readonly [string, Uint8Array]>;
    readonly missing?: readonly string[];
    readonly rejected?: readonly {
        readonly name: string;
        readonly reason: string;
    }[];
    readonly undeclared?: readonly string[];
}
export type WorkerMessage = {
    readonly type: 'log';
    readonly level: LineLevel;
    readonly message: string;
} | {
    readonly type: 'ready';
} | {
    readonly type: 'boot-error';
    readonly message: string;
} | {
    readonly type: 'result';
    readonly id: number;
    readonly result: WireResult;
    readonly evict: boolean;
} | {
    readonly type: 'connect-ask';
    readonly host: string;
};
export declare function toWireResult(result: PythonRunResult): WireResult;
export declare function fromWireResult(wire: WireResult): PythonRunResult;
export declare function asHostMessage(value: unknown): HostMessage | null;
export declare function asWorkerMessage(value: unknown): WorkerMessage | null;
