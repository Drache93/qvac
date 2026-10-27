import { type AnyMachineSnapshot, type AnyStateMachine, type Snapshot } from 'xstate';
import { type Patch } from './patch.ts';
import type { MachineLog } from './protocol-types.ts';
import type { MachineTransitionTrace } from './protocol-types.ts';
interface ReplayEvent extends Record<string, unknown> {
    type: string;
}
interface ReplayFrame {
    index: number;
    event: ReplayEvent;
    snapshot: AnyMachineSnapshot;
}
export declare class ReplayDivergence extends Error {
    readonly index: number;
    readonly drift: Patch;
    constructor(index: number, drift: Patch);
}
export declare class ReplayTraceDivergence extends Error {
    readonly index: number;
    readonly expected: MachineTransitionTrace[];
    readonly actual: MachineTransitionTrace[];
    constructor(index: number, expected: MachineTransitionTrace[], actual: MachineTransitionTrace[]);
}
export declare function replayRun(machine: AnyStateMachine, core: MachineLog): AsyncGenerator<ReplayFrame>;
export declare function parsePersistedSnapshot(value: unknown): Snapshot<unknown>;
export {};
